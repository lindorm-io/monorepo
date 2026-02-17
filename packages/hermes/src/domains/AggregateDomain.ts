import { parseAes, SerialisedAesDecryption } from "@lindorm/aes";
import { snakeCase } from "@lindorm/case";
import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { MessageKit } from "@lindorm/message";
import { ClassLike, Dict } from "@lindorm/types";
import { findLast, removeUndefined } from "@lindorm/utils";
import merge from "deepmerge";
import {
  AggregateAlreadyCreatedError,
  AggregateDestroyedError,
  AggregateNotCreatedError,
  CausationMissingEventsError,
  CommandSchemaValidationError,
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
} from "../errors";
import { HermesAggregateCommandHandler, HermesAggregateErrorHandler } from "../handlers";
import {
  IAggregateCommandHandler,
  IAggregateDomain,
  IAggregateErrorHandler,
  IAggregateModel,
  IEventStore,
  IHermesEncryptionStore,
  IHermesMessage,
  IHermesMessageBus,
  IHermesRegistry,
} from "../interfaces";
import { HermesEvent } from "../messages";
import { AggregateModel } from "../models";
import { DispatchMessageSchema } from "../schemas/dispatch-command";
import {
  AggregateCommandCtx,
  AggregateErrorCtx,
  AggregateErrorDispatchOptions,
  AggregateIdentifier,
  EventStoreAttributes,
  HermesErrorData,
  HermesMessageOptions,
} from "../types";
import { AggregateDomainOptions } from "../types/domain";
import {
  assertChecksum,
  createChecksum,
  extractDataTransferObject,
  recoverCommand,
  recoverError,
} from "../utils/private";

export class AggregateDomain implements IAggregateDomain {
  private readonly logger: ILogger;

  private readonly commandBus: IHermesMessageBus;
  private readonly encryptionStore: IHermesEncryptionStore;
  private readonly errorBus: IHermesMessageBus;
  private readonly eventBus: IHermesMessageBus;
  private readonly eventStore: IEventStore;
  private readonly registry: IHermesRegistry;
  private readonly messageKit: MessageKit<HermesEvent>;

  public constructor(options: AggregateDomainOptions) {
    this.logger = options.logger.child(["AggregateDomain"]);

    this.commandBus = options.commandBus;
    this.encryptionStore = options.encryptionStore;
    this.errorBus = options.errorBus;
    this.eventBus = options.eventBus;
    this.eventStore = options.eventStore;
    this.registry = options.registry;

    this.messageKit = new MessageKit({ target: HermesEvent, logger: this.logger });
  }

  public async registerHandlers(): Promise<void> {
    for (const handler of this.registry.aggregateCommandHandlers) {
      this.logger.debug("Registering aggregate command handler", {
        aggregate: handler.aggregate,
        command: handler.command,
        conditions: handler.conditions,
        encryption: handler.encryption,
      });

      await this.commandBus.subscribe({
        callback: (message: IHermesMessage) => this.handleCommand(message),
        queue: AggregateDomain.getCommandQueue(handler),
        topic: AggregateDomain.getCommandTopic(handler),
      });

      this.logger.verbose("Command handler registered", {
        aggregate: handler.aggregate,
        command: handler.command,
        conditions: handler.conditions,
        encryption: handler.encryption,
      });
    }

    for (const handler of this.registry.aggregateErrorHandlers) {
      this.logger.debug("Registering aggregate error handler", {
        aggregate: handler.aggregate,
        error: handler.error,
      });

      await this.errorBus.subscribe({
        callback: (message: IHermesMessage<HermesErrorData>) => this.handleError(message),
        queue: AggregateDomain.getErrorQueue(handler),
        topic: AggregateDomain.getErrorTopic(handler),
      });

      this.logger.verbose("Error handler registered", {
        aggregate: handler.aggregate,
        error: handler.error,
      });
    }
  }

  public async inspect<S extends Dict = Dict>(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<IAggregateModel<S>> {
    return (await this.load(aggregateIdentifier)) as IAggregateModel<S>;
  }

  // private

  private async dispatchCommand(
    causation: IHermesMessage<HermesErrorData>,
    message: ClassLike,
    options: AggregateErrorDispatchOptions = {},
  ): Promise<void> {
    this.logger.debug("Dispatch", { causation, message, options });

    DispatchMessageSchema.parse({ causation, message, options });

    const metadata = this.registry.getCommand(message.constructor);

    const aggregate: AggregateIdentifier = {
      id: options.id || causation.aggregate.id,
      name: metadata.aggregate.name,
      namespace: metadata.aggregate.namespace,
    };

    const { name, version } = metadata;
    const { data } = extractDataTransferObject(message);
    const { delay, mandatory, meta = {} } = options;

    const command = this.commandBus.create(
      merge<HermesMessageOptions, AggregateErrorDispatchOptions>(
        {
          aggregate,
          correlationId: causation.correlationId,
          data,
          meta: { ...causation.meta, ...meta },
          name,
          version,
        },
        { delay, mandatory },
      ),
    );

    this.logger.verbose("Publishing command", { command });

    await this.commandBus.publish(command);
  }

  private async handleCommand(message: IHermesMessage): Promise<void> {
    this.logger.debug("Handling command", { message });

    const command = recoverCommand(message);

    const commandHandler = this.registry.aggregateCommandHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.namespace === message.aggregate.namespace &&
        x.command === message.name,
    );

    if (!(commandHandler instanceof HermesAggregateCommandHandler)) {
      throw new HandlerNotRegisteredError();
    }

    const conditionValidators = [];

    conditionValidators.push((aggregate: IAggregateModel) => {
      if (aggregate.destroyed) {
        throw new AggregateDestroyedError();
      }
    });

    if (commandHandler.conditions?.created === true) {
      conditionValidators.push((aggregate: IAggregateModel) => {
        if (aggregate.events.length < 1) {
          throw new AggregateNotCreatedError();
        }
      });
    }

    if (commandHandler.conditions?.created === false) {
      conditionValidators.push((aggregate: IAggregateModel) => {
        if (aggregate.events.length > 0) {
          throw new AggregateAlreadyCreatedError();
        }
      });
    }

    const aggregate = await this.load(message.aggregate);
    const lastCausationMatchesCommandId = findLast(aggregate.events, {
      causationId: message.id,
    });

    try {
      if (!lastCausationMatchesCommandId) {
        if (commandHandler.schema) {
          try {
            await commandHandler.schema.parse(message.data);
          } catch (error: any) {
            throw new CommandSchemaValidationError(error);
          }
        }

        for (const validator of conditionValidators) {
          validator(aggregate);
        }

        const ctx: AggregateCommandCtx<typeof command, Dict> = {
          command,
          logger: this.logger.child(["AggregateCommandHandler"]),
          meta: message.meta,
          state: structuredClone(aggregate.state),

          apply: aggregate.apply.bind(aggregate, message),
        };

        await commandHandler.handler(ctx);
      }

      const events = await this.save(aggregate, message, commandHandler.encryption);

      await this.eventBus.publish(events);

      this.logger.verbose("Handled command", { message });
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

  private async handleError(message: IHermesMessage<HermesErrorData>): Promise<void> {
    this.logger.debug("Handling error", { message });

    const error = recoverError(message);
    const command = recoverCommand(message.data.message);

    const errorHandler = this.registry.aggregateErrorHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.namespace === message.aggregate.namespace &&
        x.error === message.name,
    );

    if (!(errorHandler instanceof HermesAggregateErrorHandler)) {
      throw new HandlerNotRegisteredError();
    }

    const ctx: AggregateErrorCtx<typeof error> = {
      command,
      error,
      logger: this.logger.child(["AggregateErrorHandler"]),
      message,

      dispatch: this.dispatchCommand.bind(this, message),
    };

    try {
      await errorHandler.handler(ctx);

      this.logger.verbose("Handled error message", { message, error, event });
    } catch (err: any) {
      this.logger.error("Failed to handle error", err);
    }
  }

  private async publishError(
    causation: IHermesMessage,
    command: ClassLike,
    error: DomainError,
  ): Promise<void> {
    const message = this.errorBus.create({
      data: {
        command,
        error: error.toJSON ? error.toJSON() : { ...error },
        message: causation,
      },
      aggregate: causation.aggregate,
      causationId: causation.id,
      mandatory: true,
      meta: causation.meta,
      name: snakeCase(error.name),
    });

    this.logger.debug("Publishing unrecoverable error", {
      causation,
      command,
      error,
      message,
    });

    try {
      await this.errorBus.publish(message);

      this.logger.verbose("Published unrecoverable error", {
        causation,
        command,
        error,
        message,
      });
    } catch (err: any) {
      this.logger.warn("Failed to publish unrecoverable error", err);

      throw err;
    }
  }

  private async load(
    aggregateIdentifier: AggregateIdentifier,
  ): Promise<IAggregateModel<Dict>> {
    this.logger.debug("Loading aggregate", { aggregateIdentifier });

    const data = await this.eventStore.find(aggregateIdentifier);

    await this.warnIfChecksumMismatch(data);

    const decrypted = await this.decryptAttributes(aggregateIdentifier, data);

    const aggregate = new AggregateModel({
      ...aggregateIdentifier,
      eventBus: this.eventBus,
      logger: this.logger,
      registry: this.registry,
    });

    const events = decrypted.map(this.toHermesEvent.bind(this));

    for (const event of events) {
      await aggregate.load(event);
    }

    this.logger.debug("Loaded aggregate", { aggregate: aggregate.toJSON() });

    return aggregate;
  }

  private async save(
    aggregate: IAggregateModel,
    causation: IHermesMessage,
    encryption: boolean,
  ): Promise<Array<HermesEvent<Dict>>> {
    this.logger.debug("Saving aggregate", { aggregate: aggregate.toJSON(), causation });

    const events = await this.eventStore.find({
      id: aggregate.id,
      name: aggregate.name,
      namespace: aggregate.namespace,
      causation_id: causation.id,
    });

    if (events?.length) {
      this.logger.debug("Found events matching causation", { events });

      return events.map((item) => this.toHermesEvent(item));
    }

    const causationEvents = aggregate.events.filter(
      (x) => x.causationId === causation.id,
    );

    if (causationEvents.length === 0) {
      throw new CausationMissingEventsError();
    }

    const expectedEvents = aggregate.events.slice(0, aggregate.numberOfLoadedEvents);
    const [lastExpectedEvent] = expectedEvents.reverse();

    this.logger.debug("Saving aggregate", {
      aggregate,
      causationEvents,
      encryption,
      expectedEvents,
      lastExpectedEvent,
    });

    const initial: Array<EventStoreAttributes> = causationEvents.map((event) => ({
      aggregate_id: aggregate.id,
      aggregate_name: aggregate.name,
      aggregate_namespace: aggregate.namespace,
      causation_id: causation.id,
      checksum: "",
      correlation_id: causation.correlationId,
      data: event.data,
      encrypted: encryption,
      event_id: event.id,
      event_name: event.name,
      event_timestamp: event.timestamp,
      expected_events: expectedEvents.length,
      meta: event.meta,
      previous_event_id: lastExpectedEvent ? lastExpectedEvent.id : null,
      version: event.version,
      created_at: event.timestamp,
    }));

    const encrypted = await this.encryptAttributes(aggregate, initial);
    const attributes = this.addChecksumToAttributes(encrypted);

    await this.eventStore.insert(attributes);

    return causationEvents;
  }

  private addChecksumToAttributes(
    attributes: Array<EventStoreAttributes>,
  ): Array<EventStoreAttributes> {
    const result: Array<EventStoreAttributes> = [];

    for (const item of attributes) {
      const { checksum, ...rest } = item;
      result.push({ ...rest, checksum: createChecksum(rest) });
    }

    return result;
  }

  private async encryptAttributes(
    aggregateIdentifier: AggregateIdentifier,
    attributes: Array<EventStoreAttributes>,
  ): Promise<Array<EventStoreAttributes>> {
    if (!attributes.some((x) => x.encrypted)) {
      return attributes;
    }

    const aes = await this.encryptionStore.load(aggregateIdentifier);
    const result: Array<EventStoreAttributes> = [];

    for (const item of attributes) {
      const { data, ...rest } = item;

      const encrypted = aes.encrypt(JsonKit.buffer(data), "serialised");

      result.push({ ...rest, data: removeUndefined(encrypted) });
    }

    return result;
  }

  private async decryptAttributes(
    aggregateIdentifier: AggregateIdentifier,
    attributes: Array<EventStoreAttributes>,
  ): Promise<Array<EventStoreAttributes>> {
    if (!attributes.some((x) => x.encrypted)) {
      return attributes;
    }

    const aes = await this.encryptionStore.load(aggregateIdentifier);
    const result: Array<EventStoreAttributes> = [];

    for (const item of attributes) {
      if (!item.encrypted) {
        result.push(item);
        continue;
      }

      try {
        const parsed = parseAes(item.data as SerialisedAesDecryption);

        if (parsed.keyId && parsed.keyId !== aes.kryptos.id) {
          this.logger.info("Encryption key mismatch", {
            expect: parsed.keyId,
            actual: aes.kryptos.id,
          });
          continue;
        }

        const data = JsonKit.parse(aes.decrypt(item.data as SerialisedAesDecryption));

        result.push({ ...item, data });
      } catch (error: any) {
        this.logger.warn("Failed to decrypt event data", error, [{ item }]);
      }
    }

    return result;
  }

  private async warnIfChecksumMismatch(
    attributes: Array<EventStoreAttributes>,
  ): Promise<void> {
    for (const event of attributes) {
      try {
        assertChecksum(event);
      } catch (error: any) {
        this.logger.warn("Checksum mismatch", error, [{ event }]);
      }
    }
  }

  private toHermesEvent(data: EventStoreAttributes): IHermesMessage {
    return this.messageKit.create({
      id: data.event_id,
      aggregate: {
        id: data.aggregate_id,
        name: data.aggregate_name,
        namespace: data.aggregate_namespace,
      },
      causationId: data.causation_id,
      correlationId: data.correlation_id,
      data: data.data,
      meta: data.meta,
      name: data.event_name,
      timestamp: data.event_timestamp,
      version: data.version,
    });
  }

  // private static

  private static getCommandQueue(handler: IAggregateCommandHandler): string {
    return `queue.aggregate.${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.command}`;
  }

  private static getCommandTopic(handler: IAggregateCommandHandler): string {
    return `${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.command}`;
  }

  private static getErrorQueue(handler: IAggregateErrorHandler): string {
    return `queue.aggregate.${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.error}`;
  }

  private static getErrorTopic(handler: IAggregateErrorHandler): string {
    return `${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.error}`;
  }
}
