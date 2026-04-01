import { AesKit, parseAes, SerialisedAesDecryption } from "@lindorm/aes";
import { snakeCase } from "@lindorm/case";
import type { IIrisMessageBus, IIrisWorkerQueue } from "@lindorm/iris";
import { JsonKit } from "@lindorm/json-kit";
import {
  KryptosKit,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosCurve,
} from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import { DuplicateKeyError } from "@lindorm/proteus";
import type { ProteusSource } from "@lindorm/proteus";
import type { ClassLike, Dict } from "@lindorm/types";
import { removeUndefined } from "@lindorm/utils";
import { randomUUID } from "@lindorm/random";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CausationMissingEventsError,
  CommandSchemaValidationError,
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
} from "../../errors";
import type { ChecksumMode } from "../../types/hermes-options";
import type {
  AggregateCommandCtx,
  AggregateErrorCtx,
  AggregateIdentifier,
  ErrorDispatchOptions,
} from "../../types";
import { ChecksumError } from "../../errors";
import { EventRecord, EncryptionRecord } from "#internal/entities";
import {
  HermesCommandMessage,
  HermesErrorMessage,
  HermesEventMessage,
} from "#internal/messages";
import type { HermesRegistry } from "#internal/registry";
import type { RegisteredAggregate, HandlerRegistration } from "#internal/registry";
import { findEvents } from "#internal/stores";
import { findEncryptionKey, insertEncryptionKey } from "#internal/stores";
import {
  assertChecksum,
  createChecksum,
  extractDto,
  recoverCommand,
} from "#internal/utils";
import { AggregateModel } from "./aggregate-model";

export type AggregateDomainOptions = {
  registry: HermesRegistry;
  proteus: ProteusSource;
  iris: {
    commandQueue: IIrisWorkerQueue<HermesCommandMessage>;
    eventBus: IIrisMessageBus<HermesEventMessage>;
    errorQueue: IIrisWorkerQueue<HermesErrorMessage>;
  };
  encryption?: {
    algorithm?: KryptosEncAlgorithm;
    encryption?: KryptosEncryption;
  };
  checksumMode?: ChecksumMode;
  logger: ILogger;
};

export class AggregateDomain {
  private readonly logger: ILogger;
  private readonly registry: HermesRegistry;
  private readonly proteus: ProteusSource;
  private readonly commandQueue: IIrisWorkerQueue<HermesCommandMessage>;
  private readonly eventBus: IIrisMessageBus<HermesEventMessage>;
  private readonly errorQueue: IIrisWorkerQueue<HermesErrorMessage>;
  private readonly encryptionAlgorithm: KryptosEncAlgorithm;
  private readonly encryptionEncryption: KryptosEncryption;
  private readonly checksumMode: ChecksumMode;

  public constructor(options: AggregateDomainOptions) {
    this.logger = options.logger.child(["AggregateDomain"]);
    this.registry = options.registry;
    this.proteus = options.proteus;
    this.commandQueue = options.iris.commandQueue;
    this.eventBus = options.iris.eventBus;
    this.errorQueue = options.iris.errorQueue;
    this.encryptionAlgorithm = options.encryption?.algorithm ?? "dir";
    this.encryptionEncryption = options.encryption?.encryption ?? "A256GCM";
    this.checksumMode = options.checksumMode ?? "warn";
  }

  public async registerHandlers(): Promise<void> {
    for (const aggregate of this.registry.allAggregates) {
      for (const handler of aggregate.commandHandlers) {
        const dto = this.registry.getCommand(handler.trigger);

        this.logger.debug("Registering aggregate command handler", {
          aggregate: aggregate.name,
          command: dto.name,
        });

        const queue = AggregateDomain.commandQueueName(aggregate, dto.name);

        await this.commandQueue.consume(queue, (message) =>
          this.handleCommand(message, aggregate, handler),
        );

        this.logger.verbose("Command handler registered", {
          aggregate: aggregate.name,
          command: dto.name,
        });
      }

      for (const handler of aggregate.errorHandlers) {
        const errorName = snakeCase(handler.trigger.name);

        this.logger.debug("Registering aggregate error handler", {
          aggregate: aggregate.name,
          error: errorName,
        });

        const queue = AggregateDomain.errorQueueName(aggregate, errorName);

        await this.errorQueue.consume(queue, (message) =>
          this.handleError(message, aggregate, handler),
        );

        this.logger.verbose("Error handler registered", {
          aggregate: aggregate.name,
          error: errorName,
        });
      }
    }
  }

  public async inspect<S extends Dict = Dict>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<AggregateModel<S>> {
    return (await this.loadAggregate(aggregateIdentifier)) as AggregateModel<S>;
  }

  // -- Command handling --

  private async handleCommand(
    message: HermesCommandMessage,
    aggregate: RegisteredAggregate,
    handler: HandlerRegistration,
  ): Promise<void> {
    this.logger.debug("Handling command", {
      aggregate: aggregate.name,
      command: message.name,
      id: message.aggregate.id,
    });

    const command = recoverCommand(this.registry, message);

    const conditionValidators = this.buildConditionValidators(handler);

    const model = await this.loadAggregate(message.aggregate);

    const alreadyProcessed = model.events.some((e) => e.causationId === message.id);

    try {
      if (alreadyProcessed) {
        // C5 fix: When the command was already processed, the events already
        // exist in the database. Skip saveEvents entirely to avoid hitting
        // the unique constraint. Re-publish the existing events for this
        // causation so downstream consumers can process them if they missed
        // the original publish.
        const existingEvents = model.events.filter((e) => e.causationId === message.id);

        this.logger.debug("Command already processed, re-publishing existing events", {
          aggregate: aggregate.name,
          command: message.name,
          eventCount: existingEvents.length,
        });

        await this.eventBus.publish(existingEvents);

        this.logger.verbose("Re-published events for already-processed command", {
          aggregate: aggregate.name,
          command: message.name,
          eventsPublished: existingEvents.length,
        });

        return;
      }

      if (handler.schema) {
        try {
          handler.schema.parse(message.data);
        } catch (error: any) {
          throw new CommandSchemaValidationError(error);
        }
      }

      for (const validator of conditionValidators) {
        validator(model);
      }

      const ctx: AggregateCommandCtx<typeof command, Dict> = {
        command,
        logger: this.logger.child(["AggregateCommandHandler"]),
        meta: message.meta,
        state: structuredClone(model.state),
        apply: model.apply.bind(model, message),
      };

      const handlerFn = this.resolveHandlerFunction(aggregate, handler);
      await handlerFn(ctx);

      const events = await this.saveEvents(model, message, aggregate.forgettable);

      await this.eventBus.publish(events);

      this.logger.verbose("Handled command", {
        aggregate: aggregate.name,
        command: message.name,
        eventsProduced: events.length,
      });
    } catch (err: any) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling command", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling command", err);
      } else {
        this.logger.error("Failed to handle command", err);
      }

      if (err instanceof DomainError && err.permanent) {
        await this.publishError(message, command, err);
      }

      throw err;
    }
  }

  // -- Error handling --

  private async handleError(
    message: HermesErrorMessage,
    aggregate: RegisteredAggregate,
    handler: HandlerRegistration,
  ): Promise<void> {
    this.logger.debug("Handling error", {
      aggregate: aggregate.name,
      error: message.name,
    });

    const dispatched: Array<{ command: ClassLike; options: ErrorDispatchOptions }> = [];

    const ctx: AggregateErrorCtx = {
      error: new DomainError(
        (message.data as Record<string, any>).error?.message ?? "Unknown error",
      ),
      logger: this.logger.child(["AggregateErrorHandler"]),
      dispatch: (command: ClassLike, options?: ErrorDispatchOptions) => {
        dispatched.push({ command, options: options ?? {} });
      },
    };

    const handlerFn = this.resolveHandlerFunction(aggregate, handler);
    await handlerFn(ctx);

    for (const { command, options } of dispatched) {
      await this.dispatchCommand(message, command, options);
    }

    this.logger.verbose("Handled error message", {
      aggregate: aggregate.name,
      error: message.name,
    });
  }

  // -- Command dispatch from error handler --

  private async dispatchCommand(
    causation: HermesErrorMessage,
    command: ClassLike,
    options: ErrorDispatchOptions,
  ): Promise<void> {
    this.logger.debug("Dispatching command from error handler");

    const metadata = this.registry.getCommand(command.constructor);
    const commandAggregate = this.registry.getCommandHandler(command.constructor);

    if (!commandAggregate) {
      throw new HandlerNotRegisteredError();
    }

    const aggregateIdentifier: AggregateIdentifier = {
      id: options.id ?? causation.aggregate.id,
      name: commandAggregate.aggregate.name,
      namespace: commandAggregate.aggregate.namespace,
    };

    const { data } = extractDto(command);

    const msg = this.commandQueue.create({
      aggregate: aggregateIdentifier,
      causationId: causation.id,
      correlationId: causation.correlationId,
      data,
      meta: options.meta ? { ...causation.meta, ...options.meta } : causation.meta,
      name: metadata.name,
      version: metadata.version,
      mandatory: options.mandatory ?? true,
    } as Partial<HermesCommandMessage>);

    await this.commandQueue.publish(msg, {
      delay: options.delay,
    });
  }

  // -- Aggregate loading --

  private async loadAggregate(
    identifier: AggregateIdentifier,
  ): Promise<AggregateModel<Dict>> {
    this.logger.debug("Loading aggregate", { identifier });

    const eventRepo = this.proteus.repository(EventRecord);
    const records = await findEvents(eventRepo, identifier);

    await this.verifyChecksums(records);

    const decrypted = await this.decryptRecords(identifier, records);

    const model = new AggregateModel({
      ...identifier,
      registry: this.registry,
      logger: this.logger,
    });

    for (const record of decrypted) {
      const eventMessage = this.recordToEventMessage(record);
      await model.load(eventMessage);
    }

    this.logger.debug("Loaded aggregate", {
      id: identifier.id,
      events: model.numberOfLoadedEvents,
      destroyed: model.destroyed,
    });

    return model;
  }

  // -- Event saving --

  private async saveEvents(
    model: AggregateModel,
    causation: HermesCommandMessage,
    forgettable: boolean,
  ): Promise<Array<HermesEventMessage>> {
    this.logger.debug("Saving aggregate events", {
      id: model.id,
      totalEvents: model.events.length,
      loadedEvents: model.numberOfLoadedEvents,
    });

    const causationEvents = model.events.filter((e) => e.causationId === causation.id);

    if (causationEvents.length === 0) {
      throw new CausationMissingEventsError();
    }

    const loadedEvents = model.events.slice(0, model.numberOfLoadedEvents);
    const lastLoadedEvent =
      loadedEvents.length > 0 ? loadedEvents[loadedEvents.length - 1] : null;

    const records: Array<EventRecord> = [];

    for (let i = 0; i < causationEvents.length; i++) {
      const event = causationEvents[i];
      const record = new EventRecord();
      record.id = event.id ?? randomUUID();
      event.id = record.id;
      record.aggregateId = model.id;
      record.aggregateName = model.name;
      record.aggregateNamespace = model.namespace;
      record.causationId = causation.id;
      record.correlationId = causation.correlationId ?? "";
      record.data = event.data;
      record.encrypted = forgettable;
      record.name = event.name;
      record.timestamp = event.timestamp;
      record.expectedEvents = loadedEvents.length + i;
      record.meta = event.meta;
      record.previousId = i === 0 ? (lastLoadedEvent?.id ?? null) : records[i - 1].id;
      record.version = event.version;
      record.checksum = "";
      records.push(record);
    }

    const encrypted = await this.encryptRecords(
      { id: model.id, name: model.name, namespace: model.namespace },
      records,
    );

    const withChecksums = this.addChecksums(encrypted);

    try {
      await this.proteus.transaction(async (ctx) => {
        const txRepo = ctx.repository(EventRecord);
        await txRepo.insert(withChecksums);
      });
    } catch (err: any) {
      if (this.isDuplicateKeyError(err)) {
        throw new ConcurrencyError("Concurrency conflict saving events", {
          data: {
            aggregateId: model.id,
            expectedEvents: loadedEvents.length,
          },
        });
      }
      throw err;
    }

    return causationEvents;
  }

  // -- Error publishing --

  private async publishError(
    causation: HermesCommandMessage,
    command: ClassLike,
    error: DomainError,
  ): Promise<void> {
    const message = this.errorQueue.create({
      aggregate: causation.aggregate,
      causationId: causation.id,
      correlationId: causation.correlationId,
      data: {
        command,
        error: error.toJSON
          ? error.toJSON()
          : { message: error.message, name: error.name },
        message: causation,
      },
      mandatory: true,
      meta: causation.meta,
      name: snakeCase(error.name),
    } as Partial<HermesErrorMessage>);

    this.logger.debug("Publishing unrecoverable error", {
      error: error.name,
      aggregate: causation.aggregate,
    });

    try {
      await this.errorQueue.publish(message);

      this.logger.verbose("Published unrecoverable error", {
        error: error.name,
      });
    } catch (err: any) {
      this.logger.warn("Failed to publish unrecoverable error", err);
      throw err;
    }
  }

  // -- Checksum utilities --

  private addChecksums(records: Array<EventRecord>): Array<EventRecord> {
    return records.map((record) => {
      const { checksum, createdAt, ...rest } = record;
      return Object.assign(record, {
        checksum: createChecksum(rest),
      });
    });
  }

  private async verifyChecksums(records: Array<EventRecord>): Promise<void> {
    for (const record of records) {
      try {
        assertChecksum(record);
      } catch (error: any) {
        if (this.checksumMode === "strict") {
          throw new ChecksumError(
            `Checksum mismatch for event ${record.id}: ${error.message}`,
          );
        }
        this.logger.warn("Checksum mismatch", error, [
          { record: { id: record.id, name: record.name } },
        ]);
      }
    }
  }

  // -- Encryption utilities --

  private async encryptRecords(
    identifier: AggregateIdentifier,
    records: Array<EventRecord>,
  ): Promise<Array<EventRecord>> {
    if (!records.some((r) => r.encrypted)) {
      return records;
    }

    const aes = await this.loadOrCreateEncryptionKey(identifier);

    return records.map((record) => {
      const encrypted = aes.encrypt(JsonKit.buffer(record.data), "serialised");
      return Object.assign(record, {
        data: removeUndefined(encrypted) as Record<string, unknown>,
      });
    });
  }

  private async decryptRecords(
    identifier: AggregateIdentifier,
    records: Array<EventRecord>,
  ): Promise<Array<EventRecord>> {
    if (!records.some((r) => r.encrypted)) {
      return records;
    }

    const aes = await this.loadEncryptionKey(identifier);

    if (!aes) {
      this.logger.warn("Encryption key not found for forgettable aggregate", {
        identifier,
      });
      return records.filter((r) => !r.encrypted);
    }

    return records.map((record) => {
      if (!record.encrypted) return record;

      try {
        const parsed = parseAes(record.data as SerialisedAesDecryption);

        if (parsed.keyId && parsed.keyId !== aes.kryptos.id) {
          this.logger.info("Encryption key mismatch", {
            expect: parsed.keyId,
            actual: aes.kryptos.id,
          });
          return record;
        }

        const data = JsonKit.parse(aes.decrypt(record.data as SerialisedAesDecryption));
        return Object.assign(record, { data });
      } catch (error: any) {
        this.logger.warn("Failed to decrypt event data", error, [{ eventId: record.id }]);
        return record;
      }
    });
  }

  private async loadEncryptionKey(
    identifier: AggregateIdentifier,
  ): Promise<AesKit | null> {
    const encRepo = this.proteus.repository(EncryptionRecord);
    const record = await findEncryptionKey(
      encRepo,
      identifier.id,
      identifier.name,
      identifier.namespace,
    );

    if (!record) return null;

    const kryptos = KryptosKit.from.b64({
      id: record.keyId,
      algorithm: record.keyAlgorithm as KryptosEncAlgorithm,
      curve: (record.keyCurve as KryptosCurve) ?? undefined,
      encryption: record.keyEncryption as KryptosEncryption,
      privateKey: record.privateKey,
      publicKey: record.publicKey || undefined,
      type: record.keyType as any,
      use: "enc",
    });

    return new AesKit({ kryptos });
  }

  private async loadOrCreateEncryptionKey(
    identifier: AggregateIdentifier,
  ): Promise<AesKit> {
    const existing = await this.loadEncryptionKey(identifier);
    if (existing) return existing;

    const kryptos = KryptosKit.generate.auto({
      algorithm: this.encryptionAlgorithm,
      encryption: this.encryptionEncryption,
    });

    const { algorithm, privateKey, publicKey, type, curve, encryption } =
      kryptos.export("b64");

    const encRepo = this.proteus.repository(EncryptionRecord);
    const record = new EncryptionRecord();
    record.id = randomUUID();
    record.aggregateId = identifier.id;
    record.aggregateName = identifier.name;
    record.aggregateNamespace = identifier.namespace;
    record.keyId = kryptos.id;
    record.keyAlgorithm = String(algorithm);
    record.keyCurve = curve ? String(curve) : null;
    record.keyEncryption = String(encryption ?? this.encryptionEncryption);
    record.keyType = String(type);
    record.privateKey = privateKey ?? "";
    record.publicKey = publicKey ?? "";

    try {
      await insertEncryptionKey(encRepo, record);
      return new AesKit({ kryptos });
    } catch (err: unknown) {
      if (this.isDuplicateKeyError(err)) {
        // Another concurrent request won the race -- load the key they created
        const raceWinner = await this.loadEncryptionKey(identifier);
        if (raceWinner) return raceWinner;
      }
      throw err;
    }
  }

  // -- Record/message conversion --

  private recordToEventMessage(record: EventRecord): HermesEventMessage {
    const message = new HermesEventMessage();
    message.id = record.id;
    message.aggregate = {
      id: record.aggregateId,
      name: record.aggregateName,
      namespace: record.aggregateNamespace,
    };
    message.causationId = record.causationId;
    message.correlationId = record.correlationId || null;
    message.data = record.data;
    message.meta = record.meta;
    message.name = record.name;
    message.version = record.version;
    message.timestamp = record.timestamp;
    return message;
  }

  // -- Condition validators --

  private buildConditionValidators(
    handler: HandlerRegistration,
  ): Array<(model: AggregateModel) => void> {
    const validators: Array<(model: AggregateModel) => void> = [];

    validators.push((model) => {
      if (model.destroyed) {
        throw new AggregateDestroyedError();
      }
    });

    if (handler.conditions.requireCreated) {
      validators.push((model) => {
        if (model.events.length < 1) {
          throw new AggregateNotCreatedError();
        }
      });
    }

    if (handler.conditions.requireNotCreated) {
      validators.push((model) => {
        if (model.events.length > 0) {
          throw new AggregateAlreadyCreatedError();
        }
      });
    }

    return validators;
  }

  // -- Handler resolution --

  private resolveHandlerFunction(
    aggregate: RegisteredAggregate,
    handler: HandlerRegistration,
  ): (ctx: any) => Promise<void> {
    const instance = new aggregate.target();
    const method = (instance as Record<string, unknown>)[handler.methodName];

    if (typeof method !== "function") {
      throw new HandlerNotRegisteredError();
    }

    return method.bind(instance);
  }

  // -- Duplicate key detection --

  private isDuplicateKeyError(err: any): boolean {
    if (err instanceof DuplicateKeyError) {
      return true;
    }

    const msg = err?.message?.toLowerCase() ?? "";
    return (
      msg.includes("duplicate key") ||
      msg.includes("duplicate primary key") ||
      msg.includes("unique constraint") ||
      msg.includes("unique_violation") ||
      err?.code === "23505" ||
      err?.code === 11000
    );
  }

  // -- Queue naming --

  private static commandQueueName(
    aggregate: RegisteredAggregate,
    commandName: string,
  ): string {
    return `queue.aggregate.${aggregate.namespace}.${aggregate.name}.${commandName}`;
  }

  private static errorQueueName(
    aggregate: RegisteredAggregate,
    errorName: string,
  ): string {
    return `queue.aggregate.error.${aggregate.namespace}.${aggregate.name}.${errorName}`;
  }
}
