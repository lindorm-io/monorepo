import { snakeCase } from "@lindorm/case";
import type { ILogger } from "@lindorm/logger";
import type { IIrisMessageBus, IIrisWorkerQueue } from "@lindorm/iris";
import { DuplicateKeyError, OptimisticLockError } from "@lindorm/proteus";
import type { IProteusRepository, ProteusSource } from "@lindorm/proteus";
import type { ClassLike, Dict } from "@lindorm/types";
import EventEmitter from "events";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../../errors";
import type { ErrorDispatchOptions, SagaErrorCtx } from "../../types";
import type { HermesRegistry } from "#internal/registry";
import type { HandlerRegistration, RegisteredSaga } from "#internal/registry/types";
import { CausationRecord, SagaRecord } from "#internal/entities";
import type {
  HermesCommandMessage,
  HermesErrorMessage,
  HermesEventMessage,
  HermesTimeoutMessage,
} from "#internal/messages";
import { causationExists, loadSaga, clearMessages } from "#internal/stores";
import { SagaModel } from "./saga-model";
import type { SagaPendingMessage } from "./saga-model";

export type SagaDomainOptions = {
  registry: HermesRegistry;
  proteusSource: ProteusSource;
  eventBus: IIrisMessageBus<HermesEventMessage>;
  commandQueue: IIrisWorkerQueue<HermesCommandMessage>;
  timeoutQueue: IIrisWorkerQueue<HermesTimeoutMessage>;
  errorQueue: IIrisWorkerQueue<HermesErrorMessage>;
  causationExpiryMs: number;
  logger: ILogger;
};

type EventEmitterSagaData = {
  id: string;
  name: string;
  namespace: string;
  destroyed: boolean;
  state: Dict;
};

export class SagaDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly logger: ILogger;
  private readonly registry: HermesRegistry;
  private readonly proteusSource: ProteusSource;
  private readonly eventBus: IIrisMessageBus<HermesEventMessage>;
  private readonly commandQueue: IIrisWorkerQueue<HermesCommandMessage>;
  private readonly timeoutQueue: IIrisWorkerQueue<HermesTimeoutMessage>;
  private readonly errorQueue: IIrisWorkerQueue<HermesErrorMessage>;
  private readonly causationExpiryMs: number;

  public constructor(options: SagaDomainOptions) {
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.child(["SagaDomain"]);
    this.registry = options.registry;
    this.proteusSource = options.proteusSource;
    this.eventBus = options.eventBus;
    this.commandQueue = options.commandQueue;
    this.timeoutQueue = options.timeoutQueue;
    this.errorQueue = options.errorQueue;
    this.causationExpiryMs = options.causationExpiryMs;
  }

  public on(evt: string, listener: (data: EventEmitterSagaData) => void): void {
    this.eventEmitter.on(evt, listener);
  }

  public off(evt: string, listener: (data: EventEmitterSagaData) => void): void {
    this.eventEmitter.off(evt, listener);
  }

  public removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }

  public async registerHandlers(): Promise<void> {
    for (const saga of this.registry.allSagas) {
      await this.registerSagaEventHandlers(saga);
      await this.registerSagaTimeoutHandlers(saga);
      await this.registerSagaErrorHandlers(saga);
    }
  }

  public async inspect(identifier: {
    id: string;
    name: string;
    namespace: string;
  }): Promise<SagaRecord | null> {
    const repo = this.proteusSource.repository(SagaRecord);
    return loadSaga(repo, identifier);
  }

  // -- Registration --

  private async registerSagaEventHandlers(saga: RegisteredSaga): Promise<void> {
    for (const handler of saga.eventHandlers) {
      const eventDto = this.registry.getEvent(handler.trigger);
      const aggregate = this.registry.getAggregateForEvent(
        handler.trigger,
        saga.aggregates,
      );

      const topic = `${aggregate.namespace}.${aggregate.name}.${eventDto.name}`;
      const queue = `queue.saga.${saga.namespace}.${saga.name}.${eventDto.name}`;

      this.logger.debug("Registering saga event handler", {
        saga: { name: saga.name, namespace: saga.namespace },
        aggregate: { name: aggregate.name, namespace: aggregate.namespace },
        event: { name: eventDto.name, version: eventDto.version },
        topic,
        queue,
      });

      await this.eventBus.subscribe({
        topic,
        queue,
        callback: async (message) => this.handleEvent(message, saga, handler),
      });

      this.logger.verbose("Saga event handler registered", {
        saga: { name: saga.name, namespace: saga.namespace },
        event: { name: eventDto.name, version: eventDto.version },
      });
    }
  }

  private async registerSagaTimeoutHandlers(saga: RegisteredSaga): Promise<void> {
    for (const handler of saga.timeoutHandlers) {
      const timeoutDto = this.registry.getTimeout(handler.trigger);

      const queue = `queue.saga.timeout.${saga.namespace}.${saga.name}.${timeoutDto.name}`;

      this.logger.debug("Registering saga timeout handler", {
        saga: { name: saga.name, namespace: saga.namespace },
        timeout: { name: timeoutDto.name },
        queue,
      });

      await this.timeoutQueue.consume({
        queue,
        callback: async (message) => this.handleTimeout(message, saga, handler),
      });

      this.logger.verbose("Saga timeout handler registered", {
        saga: { name: saga.name, namespace: saga.namespace },
        timeout: { name: timeoutDto.name },
      });
    }
  }

  private async registerSagaErrorHandlers(saga: RegisteredSaga): Promise<void> {
    for (const handler of saga.errorHandlers) {
      const errorName = snakeCase(handler.trigger.name);

      const queue = `queue.saga.error.${saga.namespace}.${saga.name}.${errorName}`;

      this.logger.debug("Registering saga error handler", {
        saga: { name: saga.name, namespace: saga.namespace },
        error: errorName,
        queue,
      });

      await this.errorQueue.consume({
        queue,
        callback: async (message) => this.handleError(message, saga, handler),
      });

      this.logger.verbose("Saga error handler registered", {
        saga: { name: saga.name, namespace: saga.namespace },
        error: errorName,
      });
    }
  }

  // -- Event handling --

  private async handleEvent(
    message: HermesEventMessage,
    saga: RegisteredSaga,
    handler: HandlerRegistration,
  ): Promise<void> {
    this.logger.debug("Handling saga event", {
      messageId: message.id,
      saga: { name: saga.name, namespace: saga.namespace },
    });

    const event = this.hydrateDto(handler.trigger, message.data);
    const sagaId = this.resolveSagaId(message, event, saga);

    const sagaRepo = this.proteusSource.repository(SagaRecord);
    const causationRepo = this.proteusSource.repository(CausationRecord);

    const sagaIdentifier = { id: sagaId, name: saga.name, namespace: saga.namespace };
    let existingRecord = await loadSaga(sagaRepo, sagaIdentifier);

    // C2 recovery: publish any pending messages from a previous partial failure.
    // After recovery the DB revision is bumped, so reload the record.
    const recovered = await this.recoverPendingMessages(existingRecord);
    if (recovered) {
      existingRecord = await loadSaga(sagaRepo, sagaIdentifier);
    }

    const isDuplicate = await causationExists(
      causationRepo,
      sagaId,
      saga.name,
      message.id,
    );

    if (isDuplicate) {
      this.logger.debug("Causation already processed, skipping", {
        sagaId,
        causationId: message.id,
      });
      return;
    }

    const model = this.createModel(sagaIdentifier, existingRecord, saga);

    try {
      this.validateConditions(model, handler);

      const ctx = this.buildEventCtx(model, message, event);
      const instance = new saga.target();
      const handlerFn = instance[handler.methodName];

      if (typeof handlerFn !== "function") {
        throw new HandlerNotRegisteredError();
      }

      await handlerFn.call(instance, ctx);

      await this.saveWithCausation(
        sagaRepo,
        causationRepo,
        model,
        sagaId,
        saga.name,
        message.id,
      );
      await this.publishMessages(model);

      this.logger.verbose("Handled saga event", {
        messageId: message.id,
        saga: sagaIdentifier,
      });

      this.emit(model);
    } catch (err: unknown) {
      await this.handleDomainError(err, message, saga, model);
    }
  }

  // -- Timeout handling --

  private async handleTimeout(
    message: HermesTimeoutMessage,
    saga: RegisteredSaga,
    handler: HandlerRegistration,
  ): Promise<void> {
    this.logger.debug("Handling saga timeout", {
      messageId: message.id,
      saga: { name: saga.name, namespace: saga.namespace },
    });

    const timeout = this.hydrateDto(handler.trigger, message.data);
    const sagaId = message.aggregate.id;

    const sagaRepo = this.proteusSource.repository(SagaRecord);
    const causationRepo = this.proteusSource.repository(CausationRecord);

    const sagaIdentifier = { id: sagaId, name: saga.name, namespace: saga.namespace };
    let existingRecord = await loadSaga(sagaRepo, sagaIdentifier);

    // C2 recovery: publish any pending messages from a previous partial failure.
    // After recovery the DB revision is bumped, so reload the record.
    const recovered = await this.recoverPendingMessages(existingRecord);
    if (recovered) {
      existingRecord = await loadSaga(sagaRepo, sagaIdentifier);
    }

    const isDuplicate = await causationExists(
      causationRepo,
      sagaId,
      saga.name,
      message.id,
    );

    if (isDuplicate) {
      this.logger.debug("Timeout causation already processed, skipping", {
        sagaId,
        causationId: message.id,
      });
      return;
    }

    const model = this.createModel(sagaIdentifier, existingRecord, saga);

    try {
      if (model.destroyed) {
        throw new SagaDestroyedError();
      }

      const ctx = this.buildTimeoutCtx(model, message, timeout);
      const instance = new saga.target();
      const handlerFn = instance[handler.methodName];

      if (typeof handlerFn !== "function") {
        throw new HandlerNotRegisteredError();
      }

      await handlerFn.call(instance, ctx);

      await this.saveWithCausation(
        sagaRepo,
        causationRepo,
        model,
        sagaId,
        saga.name,
        message.id,
      );
      await this.publishMessages(model);

      this.logger.verbose("Handled saga timeout", {
        messageId: message.id,
        saga: sagaIdentifier,
      });

      this.emit(model);
    } catch (err: unknown) {
      await this.handleDomainError(err, message, saga, model);
    }
  }

  // -- Error handling (registered error handlers) --

  private async handleError(
    message: HermesErrorMessage,
    saga: RegisteredSaga,
    handler: HandlerRegistration,
  ): Promise<void> {
    this.logger.debug("Handling saga error", {
      saga: { name: saga.name, namespace: saga.namespace },
      error: message.name,
    });

    const dispatched: Array<{ command: ClassLike; options: ErrorDispatchOptions }> = [];

    const ctx: SagaErrorCtx = {
      error: new DomainError(
        (message.data as Record<string, any>).error?.message ?? "Unknown error",
      ),
      logger: this.logger.child(["SagaErrorHandler"]),
      dispatch: (command: ClassLike, options?: ErrorDispatchOptions) => {
        dispatched.push({ command, options: options ?? {} });
      },
    };

    const instance = new saga.target();
    const handlerFn = instance[handler.methodName];

    if (typeof handlerFn !== "function") {
      throw new HandlerNotRegisteredError();
    }

    await handlerFn.call(instance, ctx);

    for (const { command, options } of dispatched) {
      await this.dispatchErrorCommand(message, command, options);
    }

    this.logger.verbose("Handled saga error message", {
      saga: { name: saga.name, namespace: saga.namespace },
      error: message.name,
    });
  }

  private async dispatchErrorCommand(
    causation: HermesErrorMessage,
    command: ClassLike,
    options: ErrorDispatchOptions,
  ): Promise<void> {
    this.logger.debug("Dispatching command from saga error handler");

    const metadata = this.registry.getCommand(command.constructor);
    const commandAggregate = this.registry.getCommandHandler(command.constructor);

    if (!commandAggregate) {
      throw new HandlerNotRegisteredError();
    }

    const { ...data } = command;

    const msg = this.commandQueue.create({
      aggregate: {
        id: options.id ?? causation.aggregate.id,
        name: commandAggregate.aggregate.name,
        namespace: commandAggregate.aggregate.namespace,
      },
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

  // -- ID resolution --

  private resolveSagaId(
    message: HermesEventMessage,
    event: ClassLike,
    saga: RegisteredSaga,
  ): string {
    const idHandler = saga.idHandlers.find((h) => {
      const eventDto = this.registry.getEvent(h.trigger);
      return eventDto.name === message.name && eventDto.version === message.version;
    });

    if (!idHandler) {
      return message.aggregate.id;
    }

    const instance = new saga.target();
    const idFn = instance[idHandler.methodName];

    if (typeof idFn !== "function") {
      return message.aggregate.id;
    }

    return idFn.call(instance, {
      event,
      aggregate: message.aggregate,
      logger: this.logger.child(["SagaIdHandler"]),
    });
  }

  // -- Model creation --

  private createModel(
    identifier: { id: string; name: string; namespace: string },
    record: SagaRecord | null,
    _saga: RegisteredSaga,
  ): SagaModel {
    const deps = {
      registry: this.registry,
      logger: this.logger,
    };

    if (record) {
      return new SagaModel(
        {
          id: record.id,
          name: record.name,
          namespace: record.namespace,
          destroyed: record.destroyed,
          messagesToDispatch: record.messagesToDispatch as Array<SagaPendingMessage>,
          revision: record.revision,
          state: record.state,
        },
        deps,
      );
    }

    return new SagaModel(
      {
        id: identifier.id,
        name: identifier.name,
        namespace: identifier.namespace,
      },
      deps,
    );
  }

  // -- Condition validation --

  private validateConditions(model: SagaModel, handler: HandlerRegistration): void {
    if (model.destroyed) {
      throw new SagaDestroyedError();
    }

    if (handler.conditions.requireCreated && model.revision < 1) {
      throw new SagaNotCreatedError(true);
    }

    if (handler.conditions.requireNotCreated && model.revision > 0) {
      throw new SagaAlreadyCreatedError(true);
    }
  }

  // -- Context builders --

  private buildEventCtx(
    model: SagaModel,
    message: HermesEventMessage,
    event: ClassLike,
  ): Record<string, unknown> {
    return {
      event,
      state: structuredClone(model.state),
      aggregate: message.aggregate,
      logger: this.logger.child(["SagaEventHandler"]),
      meta: message.meta,
      destroy: model.destroy.bind(model),
      mergeState: model.mergeState.bind(model),
      setState: model.setState.bind(model),
      dispatch: (cmd: ClassLike, options?: Record<string, unknown>) =>
        model.dispatch(message.id, message.correlationId, message.meta, cmd, options),
      timeout: (name: string, data: Dict, delay: number) =>
        model.timeout(message.id, message.correlationId, message.meta, name, data, delay),
    };
  }

  private buildTimeoutCtx(
    model: SagaModel,
    message: HermesTimeoutMessage,
    timeout: ClassLike,
  ): Record<string, unknown> {
    return {
      event: timeout,
      state: structuredClone(model.state),
      aggregate: message.aggregate,
      logger: this.logger.child(["SagaTimeoutHandler"]),
      meta: message.meta,
      destroy: model.destroy.bind(model),
      mergeState: model.mergeState.bind(model),
      setState: model.setState.bind(model),
      dispatch: (cmd: ClassLike, options?: Record<string, unknown>) =>
        model.dispatch(message.id, message.correlationId, message.meta, cmd, options),
      timeout: (name: string, data: Dict, delay: number) =>
        model.timeout(message.id, message.correlationId, message.meta, name, data, delay),
    };
  }

  // -- Persistence --

  private async saveWithCausation(
    _sagaRepo: IProteusRepository<SagaRecord>,
    _causationRepo: IProteusRepository<CausationRecord>,
    model: SagaModel,
    ownerId: string,
    ownerName: string,
    causationId: string,
  ): Promise<void> {
    const isNew = model.revision === 0;

    try {
      await this.proteusSource.transaction(async (tx) => {
        const txSagaRepo = tx.repository(SagaRecord);
        const txCausationRepo = tx.repository(CausationRecord);

        if (isNew) {
          const record = txSagaRepo.create({
            id: model.id,
            name: model.name,
            namespace: model.namespace,
            destroyed: model.destroyed,
            messagesToDispatch: model.messagesToDispatch as unknown[],
            state: model.state,
          });
          record.revision = 0;
          await txSagaRepo.insert(record);
        } else {
          const existing = await txSagaRepo.findOne({
            id: model.id,
            name: model.name,
            namespace: model.namespace,
          });

          if (!existing) {
            throw new Error(
              `Saga record not found for update: ${model.namespace}.${model.name}#${model.id}`,
            );
          }

          existing.destroyed = model.destroyed;
          existing.messagesToDispatch = model.messagesToDispatch as unknown[];
          existing.state = model.state;
          await txSagaRepo.save(existing);
        }

        const causation = txCausationRepo.create({
          ownerId,
          ownerName,
          causationId,
          expiresAt:
            this.causationExpiryMs > 0
              ? new Date(Date.now() + this.causationExpiryMs)
              : null,
        });
        await txCausationRepo.insert(causation);
      });
    } catch (err: unknown) {
      if (isNew && this.isDuplicateKeyError(err)) {
        throw new ConcurrencyError("Concurrency conflict creating saga", {
          data: {
            sagaId: model.id,
            sagaName: model.name,
            sagaNamespace: model.namespace,
          },
        });
      }
      if (!isNew && this.isOptimisticLockError(err)) {
        throw new ConcurrencyError(
          "Concurrency conflict updating saga (optimistic lock)",
          {
            data: {
              sagaId: model.id,
              sagaName: model.name,
              sagaNamespace: model.namespace,
            },
          },
        );
      }
      throw err;
    }
  }

  // -- Message publishing --

  private async publishAllMessages(
    messages: ReadonlyArray<SagaPendingMessage>,
  ): Promise<void> {
    for (const pending of messages) {
      if (pending.kind === "command") {
        const msg = this.commandQueue.create(
          pending.data as Partial<HermesCommandMessage>,
        );
        await this.commandQueue.publish(
          msg,
          pending.delay ? { delay: pending.delay } : undefined,
        );
      } else {
        const msg = this.timeoutQueue.create(
          pending.data as Partial<HermesTimeoutMessage>,
        );
        await this.timeoutQueue.publish(
          msg,
          pending.delay ? { delay: pending.delay } : undefined,
        );
      }
    }
  }

  private async publishMessages(model: SagaModel): Promise<void> {
    const messages = model.messagesToDispatch;

    if (!messages.length) {
      return;
    }

    // C2 fix: messagesToDispatch is already persisted in the saga record by
    // saveWithCausation. Publish all messages first. Only after ALL publishes
    // succeed, clear messagesToDispatch from the database. If publishing fails
    // partway, the saga record still has the full list, and the recovery sweep
    // (recoverPendingMessages) will retry on the next event delivery.
    await this.publishAllMessages(messages);

    this.logger.debug("Published messages for saga", {
      id: model.id,
      name: model.name,
      namespace: model.namespace,
      count: messages.length,
    });

    // C3 fix: Clear messagesToDispatch using a version-checked conditional
    // update. After saveWithCausation, Proteus bumps the @VersionField by 1,
    // so the expected DB revision is model.revision + 1. If the revision
    // differs, another handler already modified the saga concurrently
    // (recovery will handle any remaining messages).
    const expectedRevision = model.revision + 1;
    const sagaRepo = this.proteusSource.repository(SagaRecord);
    const record = await loadSaga(sagaRepo, {
      id: model.id,
      name: model.name,
      namespace: model.namespace,
    });

    if (record && record.revision === expectedRevision) {
      await clearMessages(sagaRepo, record);
    } else {
      this.logger.debug("Saga revision changed during publish, skipping clear", {
        id: model.id,
        expectedRevision,
        actualRevision: record?.revision ?? null,
      });
    }

    model.clearMessages();
  }

  // C2 recovery sweep: Before processing a new event/timeout, check if the
  // saga has pending (unpublished) messages from a previous partial failure.
  // If so, publish them and clear the record before proceeding.
  // Returns true if recovery happened (caller should reload the record).
  private async recoverPendingMessages(record: SagaRecord | null): Promise<boolean> {
    if (!record) return false;

    const pending = record.messagesToDispatch as Array<SagaPendingMessage>;
    if (!pending.length) return false;

    this.logger.warn("Recovering pending messages from previous partial publish", {
      sagaId: record.id,
      sagaName: record.name,
      messageCount: pending.length,
    });

    await this.publishAllMessages(pending);

    const sagaRepo = this.proteusSource.repository(SagaRecord);
    await clearMessages(sagaRepo, record);

    this.logger.debug("Recovered pending messages", {
      sagaId: record.id,
      count: pending.length,
    });

    return true;
  }

  // -- Error handling --

  private async handleDomainError(
    err: unknown,
    message: HermesEventMessage | HermesTimeoutMessage,
    saga: RegisteredSaga,
    model: SagaModel,
  ): Promise<void> {
    if (err instanceof ConcurrencyError) {
      this.logger.warn("Transient concurrency error while handling saga event", err);
      throw err;
    }

    if (err instanceof DomainError) {
      this.logger.warn("Domain error while handling saga event", err);

      if (err.permanent) {
        try {
          await this.publishError(message, saga, model, err);
        } catch (pubErr) {
          this.logger.error(
            "Failed to publish saga error -- re-throwing for retry",
            pubErr as Error,
          );
          throw err;
        }
        // Permanent error successfully published; acknowledge the message
        return;
      }

      // Transient domain error -- re-throw for Iris retry
      throw err;
    }

    this.logger.error("Failed to handle saga event", err as Error);
    throw err;
  }

  private async publishError(
    causation: HermesEventMessage | HermesTimeoutMessage,
    saga: RegisteredSaga,
    model: SagaModel,
    error: DomainError,
  ): Promise<void> {
    const errorMessage = this.errorQueue.create({
      aggregate: causation.aggregate,
      causationId: causation.id,
      correlationId: causation.correlationId,
      data: {
        error: error.toJSON
          ? error.toJSON()
          : { message: error.message, name: error.name },
        saga: { id: model.id, name: model.name, namespace: model.namespace },
      },
      meta: causation.meta,
      name: snakeCase(error.name),
    });
    errorMessage.mandatory = false;

    this.logger.debug("Publishing saga error", {
      causation: causation.id,
      error: error.name,
      saga: { id: model.id, name: saga.name },
    });

    await this.errorQueue.publish(errorMessage);

    this.logger.verbose("Published saga error", {
      causation: causation.id,
      error: error.name,
    });
  }

  // -- Duplicate key detection --

  private isDuplicateKeyError(err: unknown): boolean {
    if (err instanceof DuplicateKeyError) {
      return true;
    }

    const msg = (err as any)?.message?.toLowerCase() ?? "";
    return (
      msg.includes("duplicate key") ||
      msg.includes("duplicate primary key") ||
      msg.includes("unique constraint") ||
      msg.includes("unique_violation") ||
      (err as any)?.code === "23505" ||
      (err as any)?.code === 11000
    );
  }

  private isOptimisticLockError(err: unknown): boolean {
    if (err instanceof OptimisticLockError) {
      return true;
    }

    const msg = (err as any)?.message?.toLowerCase() ?? "";
    return (
      msg.includes("optimistic lock") ||
      msg.includes("version mismatch") ||
      msg.includes("stale entity")
    );
  }

  // -- EventEmitter --

  private emit(model: SagaModel): void {
    const data: EventEmitterSagaData = {
      id: model.id,
      name: model.name,
      namespace: model.namespace,
      destroyed: model.destroyed,
      state: model.state,
    };

    this.eventEmitter.emit("saga", data);
    this.eventEmitter.emit(`saga.${model.namespace}`, data);
    this.eventEmitter.emit(`saga.${model.namespace}.${model.name}`, data);
    this.eventEmitter.emit(`saga.${model.namespace}.${model.name}.${model.id}`, data);
  }

  // -- DTO hydration --

  private hydrateDto(target: { new (): any }, data: Dict): ClassLike {
    const instance = new target();
    Object.assign(instance, data);
    return instance;
  }
}
