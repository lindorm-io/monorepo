import { snakeCase } from "@lindorm/case";
import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import merge from "deepmerge";
import EventEmitter from "events";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../errors";
import {
  HermesSagaErrorHandler,
  HermesSagaEventHandler,
  HermesSagaTimeoutHandler,
} from "../handlers";
import {
  IHermesMessage,
  IHermesMessageBus,
  IHermesRegistry,
  IHermesSagaStore,
  ISagaDomain,
  ISagaErrorHandler,
  ISagaEventHandler,
  ISagaModel,
  ISagaTimeoutHandler,
} from "../interfaces";
import { HermesCommand, HermesError, HermesTimeout } from "../messages";
import { SagaModel } from "../models";
import { DispatchMessageSchema } from "../schemas/dispatch-command";
import {
  AggregateIdentifier,
  HandlerIdentifier,
  HermesErrorData,
  HermesMessageOptions,
  SagaDomainOptions,
  SagaErrorCtx,
  SagaErrorDispatchOptions,
  SagaEventCtx,
  SagaIdCtx,
  SagaIdentifier,
  SagaTimeoutCtx,
} from "../types";
import { EventEmitterListener, EventEmitterSagaData } from "../types/event-emitter";
import {
  extractDataTransferObject,
  recoverError,
  recoverEvent,
  recoverTimeout,
} from "../utils/private";

export class SagaDomain implements ISagaDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly logger: ILogger;

  private readonly commandBus: IHermesMessageBus;
  private readonly errorBus: IHermesMessageBus;
  private readonly eventBus: IHermesMessageBus;
  private readonly registry: IHermesRegistry;
  private readonly store: IHermesSagaStore;
  private readonly timeoutBus: IHermesMessageBus;

  public constructor(options: SagaDomainOptions) {
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.child(["SagaDomain"]);

    this.commandBus = options.commandBus;
    this.errorBus = options.errorBus;
    this.eventBus = options.eventBus;
    this.registry = options.registry;
    this.store = options.store;
    this.timeoutBus = options.timeoutBus;
  }

  public on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerHandlers(): Promise<void> {
    for (const handler of this.registry.sagaErrorHandlers) {
      this.logger.debug("Registering saga error handler", {
        aggregate: handler.aggregate,
        error: handler.error,
        saga: handler.saga,
      });

      await this.errorBus.subscribe({
        callback: (message: IHermesMessage<HermesErrorData>) =>
          this.handleError(message, handler.saga),
        queue: SagaDomain.getErrorQueue(handler),
        topic: SagaDomain.getErrorTopic(handler),
      });

      this.logger.verbose("Error handler registered", {
        aggregate: handler.aggregate,
        error: handler.error,
        saga: handler.saga,
      });
    }

    for (const handler of this.registry.sagaEventHandlers) {
      this.logger.debug("Registering saga event handler", {
        aggregate: handler.aggregate,
        event: handler.event,
        saga: handler.saga,
      });

      await this.eventBus.subscribe({
        callback: (event: IHermesMessage) => this.handleEvent(event, handler.saga),
        queue: SagaDomain.getEventQueue(handler),
        topic: SagaDomain.getEventTopic(handler),
      });

      this.logger.verbose("Event handler registered", {
        aggregate: handler.aggregate,
        event: handler.event,
        saga: handler.saga,
      });
    }

    for (const handler of this.registry.sagaTimeoutHandlers) {
      this.logger.debug("Registering saga timeout handler", {
        aggregate: handler.aggregate,
        saga: handler.saga,
        timeout: handler.timeout,
      });

      await this.timeoutBus.subscribe({
        callback: (event: IHermesMessage) => this.handleTimeout(event, handler.saga),
        queue: SagaDomain.getTimeoutQueue(handler),
        topic: SagaDomain.getTimeoutTopic(handler),
      });

      this.logger.verbose("Timeout handler registered", {
        aggregate: handler.aggregate,
        saga: handler.saga,
        timeout: handler.timeout,
      });
    }
  }

  public async inspect<S extends Dict = Dict>(
    sagaIdentifier: SagaIdentifier,
  ): Promise<ISagaModel<S>> {
    return (await this.store.load(sagaIdentifier)) as ISagaModel<S>;
  }

  // private

  private async dispatchCommand(
    causation: IHermesMessage<HermesErrorData>,
    message: ClassLike,
    options: SagaErrorDispatchOptions = {},
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
      merge<HermesMessageOptions, SagaErrorDispatchOptions>(
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

    this.logger.verbose("Dispatching command", { command });

    await this.commandBus.publish(command);
  }

  private getId(
    message: IHermesMessage,
    event: ClassLike,
    handlerIdentifier: HandlerIdentifier,
  ): string {
    const idHandler = this.registry.sagaIdHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.namespace === message.aggregate.namespace &&
        x.event.name === message.name &&
        x.event.version === message.version &&
        x.saga.name === handlerIdentifier.name &&
        x.saga.namespace === handlerIdentifier.namespace,
    );

    if (!idHandler) {
      return message.aggregate.id;
    }

    const ctx: SagaIdCtx<ClassLike> = {
      aggregate: message.aggregate,
      event,
      logger: this.logger.child(["SagaIdHandler"]),
      meta: message.meta,
      saga: handlerIdentifier,
    };

    return idHandler.handler(ctx);
  }

  private async handleError(
    message: IHermesMessage<HermesErrorData>,
    handlerIdentifier: HandlerIdentifier,
  ): Promise<void> {
    this.logger.debug("Handling error", {
      message,
      handlerIdentifier,
    });

    const error = recoverError(message);
    const event = recoverEvent(message.data.message);

    const errorHandler = this.registry.sagaErrorHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.namespace === message.aggregate.namespace &&
        x.error === message.name &&
        x.saga.name === handlerIdentifier.name &&
        x.saga.namespace === handlerIdentifier.namespace,
    );

    if (!(errorHandler instanceof HermesSagaErrorHandler)) {
      throw new HandlerNotRegisteredError();
    }

    const ctx: SagaErrorCtx<typeof error> = {
      error,
      event,
      logger: this.logger.child(["SagaErrorHandler"]),
      message,
      saga: message.data.saga!,

      dispatch: this.dispatchCommand.bind(this, message),
    };

    try {
      await errorHandler.handler(ctx);

      this.logger.verbose("Handled error message", { message, error, event });
    } catch (err: any) {
      this.logger.error("Failed to handle error", err);
    }
  }

  private async handleEvent(
    message: IHermesMessage,
    handlerIdentifier: HandlerIdentifier,
  ): Promise<void> {
    this.logger.debug("Handling event", {
      message,
      handlerIdentifier,
    });

    const event = recoverEvent(message);

    const eventHandler = this.registry.sagaEventHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.namespace === message.aggregate.namespace &&
        x.event.name === message.name &&
        x.event.version === message.version &&
        x.saga.name === handlerIdentifier.name &&
        x.saga.namespace === handlerIdentifier.namespace,
    );

    if (!(eventHandler instanceof HermesSagaEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    const conditionValidators = [];

    conditionValidators.push((saga: ISagaModel) => {
      if (saga.destroyed) {
        throw new SagaDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((saga: ISagaModel) => {
        if (saga.revision < 1) {
          throw new SagaNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((saga: ISagaModel) => {
        if (saga.revision > 0) {
          throw new SagaAlreadyCreatedError(
            eventHandler.conditions.permanent === undefined ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const sagaIdentifier: SagaIdentifier = {
      id: this.getId(message, event, handlerIdentifier),
      name: handlerIdentifier.name,
      namespace: handlerIdentifier.namespace,
    };

    const data = await this.store.load(sagaIdentifier);

    let saga: ISagaModel = new SagaModel({
      ...data,
      commandBus: this.commandBus,
      logger: this.logger,
      registry: this.registry,
      timeoutBus: this.timeoutBus,
    });

    this.logger.debug("Saga loaded", { saga: saga.toJSON() });

    const causations = await this.store.loadCausations(sagaIdentifier);

    const causationExists =
      causations.includes(message.id) || saga.processedCausationIds.includes(message.id);

    this.logger.debug("Causation exists", { causationExists });

    try {
      if (!causationExists) {
        saga = await this.handleSagaForEvent(
          saga,
          message,
          event,
          eventHandler,
          conditionValidators,
        );
      }

      saga = await this.publishMessages(saga);
      saga = await this.processCausationIds(saga);

      this.logger.verbose("Handled event", { message, saga: saga.toJSON() });

      this.emit(saga);
    } catch (err: any) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling event", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling event", err);
      } else {
        this.logger.error("Failed to handle event", err);
      }

      if (err instanceof DomainError && err.permanent) {
        return await this.publishError(message, event, saga, err);
      }

      throw err;
    }
  }

  private async handleTimeout(
    message: IHermesMessage,
    handlerIdentifier: HandlerIdentifier,
  ): Promise<void> {
    this.logger.debug("Handling event", {
      message,
      handlerIdentifier,
    });

    const timeout = recoverTimeout(message);

    const conditionValidators = [];

    const timeoutHandler = this.registry.sagaTimeoutHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.namespace === message.aggregate.namespace &&
        x.timeout === message.name &&
        x.saga.name === handlerIdentifier.name &&
        x.saga.namespace === handlerIdentifier.namespace,
    );

    if (!(timeoutHandler instanceof HermesSagaTimeoutHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((saga: ISagaModel) => {
      if (saga.destroyed) {
        throw new SagaDestroyedError();
      }
    });

    const sagaIdentifier: SagaIdentifier = {
      id: this.getId(message, timeout, handlerIdentifier),
      name: handlerIdentifier.name,
      namespace: handlerIdentifier.namespace,
    };

    const data = await this.store.load(sagaIdentifier);

    let saga: ISagaModel = new SagaModel({
      ...data,
      commandBus: this.commandBus,
      logger: this.logger,
      registry: this.registry,
      timeoutBus: this.timeoutBus,
    });

    this.logger.debug("Saga loaded", { saga: saga.toJSON() });

    const causations = await this.store.loadCausations(sagaIdentifier);

    const causationExists =
      causations.includes(message.id) || saga.processedCausationIds.includes(message.id);

    this.logger.debug("Causation exists", { causationExists });

    try {
      if (!causationExists) {
        saga = await this.handleSagaForTimeout(
          saga,
          message,
          timeout,
          timeoutHandler,
          conditionValidators,
        );
      }

      saga = await this.publishMessages(saga);
      saga = await this.processCausationIds(saga);

      this.logger.verbose("Handled event", { message, saga: saga.toJSON() });

      this.emit(saga);
    } catch (err: any) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling event", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling event", err);
      } else {
        this.logger.error("Failed to handle event", err);
      }

      if (err instanceof DomainError && err.permanent) {
        return await this.publishError(message, timeout, saga, err);
      }

      throw err;
    }
  }

  private async handleSagaForEvent(
    saga: ISagaModel,
    message: IHermesMessage,
    event: ClassLike,
    eventHandler: ISagaEventHandler,
    conditionValidators: Array<(saga: ISagaModel) => void>,
  ): Promise<ISagaModel> {
    const json = saga.toJSON();

    this.logger.debug("Handling Saga", { saga: json, message });

    for (const validator of conditionValidators) {
      validator(saga);
    }

    const ctx: SagaEventCtx<ClassLike, Dict> = {
      aggregate: message.aggregate,
      event,
      logger: this.logger.child(["SagaEventHandler"]),
      meta: message.meta,
      state: structuredClone(saga.state),

      destroy: saga.destroy.bind(saga),
      dispatch: saga.dispatch.bind(saga, message),
      mergeState: saga.mergeState.bind(saga),
      setState: saga.setState.bind(saga),
    };

    await eventHandler.handler(ctx);

    const data = await this.store.save(saga, message);

    return new SagaModel({
      ...data,
      commandBus: this.commandBus,
      logger: this.logger,
      registry: this.registry,
      timeoutBus: this.timeoutBus,
    });
  }

  private async handleSagaForTimeout(
    saga: ISagaModel,
    message: IHermesMessage,
    timeout: ClassLike,
    timeoutHandler: ISagaTimeoutHandler,
    conditionValidators: Array<(saga: ISagaModel) => void>,
  ): Promise<ISagaModel> {
    const json = saga.toJSON();

    this.logger.debug("Handling Saga", { saga: json, message });

    for (const validator of conditionValidators) {
      validator(saga);
    }

    const ctx: SagaTimeoutCtx<ClassLike, Dict> = {
      aggregate: message.aggregate,
      logger: this.logger.child(["SagaTimeoutHandler"]),
      meta: message.meta,
      state: structuredClone(saga.state),
      timeout,

      destroy: saga.destroy.bind(saga),
      dispatch: saga.dispatch.bind(saga, message),
      mergeState: saga.mergeState.bind(saga),
      setState: saga.setState.bind(saga),
    };

    await timeoutHandler.handler(ctx);

    const data = await this.store.save(saga, message);

    return new SagaModel({
      ...data,
      commandBus: this.commandBus,
      logger: this.logger,
      registry: this.registry,
      timeoutBus: this.timeoutBus,
    });
  }

  private async publishMessages(saga: ISagaModel): Promise<ISagaModel> {
    if (!saga.messagesToDispatch.length) {
      return saga;
    }

    await this.commandBus.publish(
      saga.messagesToDispatch.filter((x) => x instanceof HermesCommand),
    );

    await this.errorBus.publish(
      saga.messagesToDispatch.filter((x) => x instanceof HermesError),
    );

    await this.timeoutBus.publish(
      saga.messagesToDispatch.filter((x) => x instanceof HermesTimeout),
    );

    this.logger.debug("Published messages for saga", {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
      messagesToDispatch: saga.messagesToDispatch,
    });

    if (saga.revision === 0) {
      this.logger.debug("Saga is new, returning without clearing messages");
      return saga;
    }

    const data = await this.store.clearMessages(saga);

    return new SagaModel({
      ...data,
      commandBus: this.commandBus,
      logger: this.logger,
      registry: this.registry,
      timeoutBus: this.timeoutBus,
    });
  }

  private async processCausationIds(saga: ISagaModel): Promise<ISagaModel> {
    if (!saga.processedCausationIds.length) {
      return saga;
    }

    if (saga.revision === 0) {
      this.logger.debug("Saga is new, returning without saving causations");
      return saga;
    }

    this.logger.debug("Processing causation ids for saga", {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
      processedCausationIds: saga.processedCausationIds,
    });

    const data = await this.store.saveCausations(saga);

    return new SagaModel({
      ...data,
      commandBus: this.commandBus,
      logger: this.logger,
      registry: this.registry,
      timeoutBus: this.timeoutBus,
    });
  }

  private async publishError(
    causation: IHermesMessage,
    event: ClassLike,
    saga: ISagaModel,
    error: DomainError,
  ): Promise<void> {
    const message = this.errorBus.create({
      data: {
        error: error.toJSON ? error.toJSON() : { ...error },
        event,
        message: causation,
        saga: { id: saga.id, name: saga.name, namespace: saga.namespace },
      },
      aggregate: causation.aggregate,
      causationId: causation.id,
      correlationId: causation.correlationId,
      mandatory: false,
      meta: causation.meta,
      name: snakeCase(error.name),
    });

    this.logger.debug("Publishing unrecoverable error", {
      causation,
      error,
      event,
      message,
      saga,
    });

    try {
      await this.errorBus.publish(message);

      this.logger.verbose("Published unrecoverable error", {
        causation,
        error,
        event,
        message,
        saga,
      });
    } catch (err: any) {
      this.logger.warn("Failed to publish unrecoverable error", err);

      throw err;
    }
  }

  private emit<S extends Dict = Dict>(saga: ISagaModel<S>): void {
    const data: EventEmitterSagaData<S> = {
      id: saga.id,
      name: saga.name,
      namespace: saga.namespace,
      destroyed: saga.destroyed,
      state: saga.state,
    };

    this.eventEmitter.emit("saga", data);
    this.eventEmitter.emit(`saga.${saga.namespace}`, data);
    this.eventEmitter.emit(`saga.${saga.namespace}.${saga.name}`, data);
    this.eventEmitter.emit(`saga.${saga.namespace}.${saga.name}.${saga.id}`, data);
  }

  // private static

  private static getErrorQueue(handler: ISagaErrorHandler): string {
    return `queue.saga.${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.error}.${handler.saga.namespace}.${handler.saga.name}`;
  }

  private static getErrorTopic(handler: ISagaErrorHandler): string {
    return `${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.error}`;
  }

  private static getEventQueue(handler: ISagaEventHandler): string {
    return `queue.saga.${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.event.name}.${handler.saga.namespace}.${handler.saga.name}`;
  }

  private static getEventTopic(handler: ISagaEventHandler): string {
    return `${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.event.name}`;
  }

  private static getTimeoutQueue(handler: ISagaTimeoutHandler): string {
    return `queue.saga.${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.timeout}.${handler.saga.namespace}.${handler.saga.name}`;
  }

  private static getTimeoutTopic(handler: ISagaTimeoutHandler): string {
    return `${handler.aggregate.namespace}.${handler.aggregate.name}.${handler.timeout}`;
  }
}
