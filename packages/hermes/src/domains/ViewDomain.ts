import { snakeCase } from "@lindorm/case";
import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { IPostgresSource } from "@lindorm/postgres";
import { IRedisSource } from "@lindorm/redis";
import { ClassLike, Dict } from "@lindorm/types";
import merge from "deepmerge";
import EventEmitter from "events";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../errors";
import {
  HermesViewErrorHandler,
  HermesViewEventHandler,
  HermesViewQueryHandler,
} from "../handlers";
import {
  MongoViewRepository,
  NoopMongoViewRepository,
  NoopPostgresViewRepository,
  NoopRedisViewRepository,
  PostgresViewRepository,
  RedisViewRepository,
} from "../infrastructure";
import {
  IHermesMessage,
  IHermesMessageBus,
  IHermesRegistry,
  IHermesViewStore,
  IViewDomain,
  IViewErrorHandler,
  IViewEventHandler,
  IViewModel,
} from "../interfaces";
import { ViewModel } from "../models";
import { DispatchMessageSchema } from "../schemas/dispatch-command";
import {
  AggregateIdentifier,
  HandlerIdentifier,
  HermesErrorData,
  HermesMessageOptions,
  ViewDomainOptions,
  ViewErrorCtx,
  ViewErrorDispatchOptions,
  ViewEventCtx,
  ViewIdCtx,
  ViewIdentifier,
  ViewQueryCtx,
  ViewStoreSource,
} from "../types";
import { EventEmitterListener, EventEmitterViewData } from "../types/event-emitter";
import { extractDataTransferObject, recoverError, recoverEvent } from "../utils/private";

export class ViewDomain implements IViewDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly logger: ILogger;

  private readonly commandBus: IHermesMessageBus;
  private readonly errorBus: IHermesMessageBus;
  private readonly eventBus: IHermesMessageBus;
  private readonly mongo: IMongoSource | undefined;
  private readonly postgres: IPostgresSource | undefined;
  private readonly redis: IRedisSource | undefined;
  private readonly registry: IHermesRegistry;
  private readonly store: IHermesViewStore;

  public constructor(options: ViewDomainOptions) {
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.child(["ViewDomain"]);

    this.commandBus = options.commandBus;
    this.errorBus = options.errorBus;
    this.eventBus = options.eventBus;
    this.registry = options.registry;
    this.store = options.store;

    this.mongo = options.mongo;
    this.postgres = options.postgres;
    this.redis = options.redis;
  }

  public on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerHandlers(): Promise<void> {
    for (const handler of this.registry.viewErrorHandlers) {
      this.logger.debug("Registering view error handler", {
        aggregate: handler.aggregate,
        error: handler.error,
        view: handler.view,
      });

      await this.errorBus.subscribe({
        callback: (message: IHermesMessage<HermesErrorData>) =>
          this.handleError(message, handler.view),
        queue: ViewDomain.getErrorQueue(handler),
        topic: ViewDomain.getErrorTopic(handler),
      });

      this.logger.verbose("Error handler registered", {
        aggregate: handler.aggregate,
        error: handler.error,
        view: handler.view,
      });
    }

    for (const handler of this.registry.viewEventHandlers) {
      this.logger.debug("Registering view event handler", {
        aggregate: handler.aggregate,
        event: handler.event,
        source: handler.source,
        view: handler.view,
      });

      await this.eventBus.subscribe({
        callback: (message: IHermesMessage) => this.handleEvent(message, handler.view),
        queue: ViewDomain.getEventQueue(handler),
        topic: ViewDomain.getEventTopic(handler),
      });

      this.logger.verbose("Event handler registered", {
        aggregate: handler.aggregate,
        event: handler.event,
        source: handler.source,
        view: handler.view,
      });
    }
  }

  public async inspect<S extends Dict = Dict>(
    viewIdentifier: ViewIdentifier,
    source: ViewStoreSource,
  ): Promise<IViewModel<S>> {
    return (await this.store.load(viewIdentifier, source)) as IViewModel<S>;
  }

  public async query<Q extends ClassLike, S extends Dict, R>(query: Q): Promise<R> {
    this.logger.debug("Handling query", { query });

    try {
      const meta = this.registry.getQuery((query as ClassLike).constructor);

      const handler = this.registry.viewQueryHandlers.find((x) => x.query === meta.name);

      if (!(handler instanceof HermesViewQueryHandler)) {
        throw new HandlerNotRegisteredError();
      }

      const ctx: ViewQueryCtx<Q, S> = {
        query: structuredClone(query),
        logger: this.logger.child(["QueryHandler"]),
        repositories: {
          mongo: this.mongo
            ? new MongoViewRepository<S>(this.mongo, handler.view, this.logger)
            : new NoopMongoViewRepository<S>(),
          postgres: this.postgres
            ? new PostgresViewRepository<S>(this.postgres, handler.view, this.logger)
            : new NoopPostgresViewRepository<S>(),
          redis: this.redis
            ? new RedisViewRepository<S>(this.redis, handler.view, this.logger)
            : new NoopRedisViewRepository<S>(),
        },
      };

      return await handler.handler(ctx);
    } catch (err: any) {
      this.logger.error("Failed to handle query", err);
      throw err;
    }
  }

  // private

  private async dispatchCommand(
    causation: IHermesMessage<HermesErrorData>,
    message: ClassLike,
    options: ViewErrorDispatchOptions = {},
  ): Promise<void> {
    this.logger.debug("Dispatch", { causation, message, options });

    DispatchMessageSchema.parse({ causation, message, options });

    const metadata = this.registry.getCommand(message.constructor);

    if (!metadata) {
      throw new Error(
        `Cannot dispatch message of type ${message.constructor.name} - not registered`,
      );
    }

    const aggregate: AggregateIdentifier = {
      id: options.id || causation.aggregate.id,
      name: metadata.aggregate.name,
      context: metadata.aggregate.context,
    };

    const { name, data } = extractDataTransferObject(message);
    const { delay, mandatory, meta = {} } = options;

    await this.commandBus.publish(
      this.commandBus.create(
        merge<HermesMessageOptions, ViewErrorDispatchOptions>(
          {
            aggregate,
            correlationId: causation.correlationId,
            data,
            meta: { ...causation.meta, ...meta },
            name,
          },
          { delay, mandatory },
        ),
      ),
    );
  }

  private getId(
    message: IHermesMessage,
    event: ClassLike,
    handlerIdentifier: HandlerIdentifier,
  ): string {
    const idHandler = this.registry.viewIdHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.context === message.aggregate.context &&
        x.event.name === message.name &&
        x.event.version === message.version &&
        x.view.name === handlerIdentifier.name &&
        x.view.context === handlerIdentifier.context,
    );

    if (!idHandler) {
      return message.aggregate.id;
    }

    const ctx: ViewIdCtx<ClassLike> = {
      aggregate: message.aggregate,
      event,
      logger: this.logger.child(["ViewIdHandler"]),
      meta: message.meta,
      view: handlerIdentifier,
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

    const errorHandler = this.registry.viewErrorHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.context === message.aggregate.context &&
        x.error === message.name &&
        x.view.name === handlerIdentifier.name &&
        x.view.context === handlerIdentifier.context,
    );

    if (!(errorHandler instanceof HermesViewErrorHandler)) {
      throw new HandlerNotRegisteredError();
    }

    const ctx: ViewErrorCtx<typeof error> = {
      error,
      event,
      logger: this.logger.child(["ViewErrorHandler"]),
      message,
      view: message.data.view!,

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

    const conditionValidators = [];

    const eventHandler = this.registry.viewEventHandlers.find(
      (x) =>
        x.aggregate.name === message.aggregate.name &&
        x.aggregate.context === message.aggregate.context &&
        x.event.name === message.name &&
        x.event.version === message.version &&
        x.view.name === handlerIdentifier.name &&
        x.view.context === handlerIdentifier.context,
    );

    if (!(eventHandler instanceof HermesViewEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((view: IViewModel) => {
      if (view.destroyed) {
        throw new ViewDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((view: IViewModel) => {
        if (view.revision < 1) {
          throw new ViewNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((view: IViewModel) => {
        if (view.revision > 0) {
          throw new ViewAlreadyCreatedError(
            eventHandler.conditions.permanent === undefined ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const viewIdentifier: ViewIdentifier = {
      id: this.getId(message, event, handlerIdentifier),
      name: handlerIdentifier.name,
      context: handlerIdentifier.context,
    };

    const data = await this.store.load(viewIdentifier, eventHandler.source);

    let view: IViewModel = new ViewModel({
      ...data,
      logger: this.logger,
    });

    this.logger.debug("View loaded", { view: view.toJSON() });

    const causations = await this.store.loadCausations(
      viewIdentifier,
      eventHandler.source,
    );

    const causationExists =
      causations.includes(message.id) || view.processedCausationIds.includes(message.id);

    this.logger.debug("Causation exists", { causationExists });

    try {
      if (!causationExists) {
        view = await this.handleView(
          view,
          message,
          event,
          eventHandler,
          conditionValidators,
        );
      }

      view = await this.processCausationIds(view, eventHandler);

      this.logger.verbose("Handled event", { message, event, view: view.toJSON() });

      this.emit(view);
    } catch (err: any) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling event", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling event", err);
      } else {
        this.logger.error("Failed to handle event", err);
      }

      if (err instanceof DomainError && err.permanent) {
        return await this.publishError(message, event, view, err);
      }

      throw err;
    }
  }

  private async handleView(
    view: IViewModel,
    message: IHermesMessage,
    event: ClassLike,
    eventHandler: IViewEventHandler,
    conditionValidators: Array<(view: IViewModel) => void>,
  ): Promise<IViewModel> {
    const json = view.toJSON();

    this.logger.debug("Handling View", { view: json, event: message });

    for (const validator of conditionValidators) {
      validator(view);
    }

    const ctx: ViewEventCtx<ClassLike, Dict> = {
      event,
      logger: this.logger.child(["ViewEventHandler"]),
      meta: message.meta,
      state: structuredClone(view.state),

      destroy: view.destroy.bind(view, message),
      mergeState: view.mergeState.bind(view, message),
      setState: view.setState.bind(view, message),
    };

    await eventHandler.handler(ctx);

    const data = await this.store.save(view, message, eventHandler.source);

    this.logger.debug("Saved view at new revision", {
      id: data.id,
      name: data.name,
      context: data.context,
      revision: data.revision,
    });

    return new ViewModel({ ...data, logger: this.logger });
  }

  private async processCausationIds(
    view: IViewModel,
    eventHandler: IViewEventHandler,
  ): Promise<IViewModel> {
    if (!view.processedCausationIds.length) {
      return view;
    }

    if (view.revision === 0) {
      return view;
    }

    this.logger.debug("Processing causation ids for view", {
      id: view.id,
      name: view.name,
      context: view.context,
      processedCausationIds: view.processedCausationIds,
    });

    const data = await this.store.saveCausations(view, eventHandler.source);

    return new ViewModel({ ...data, logger: this.logger });
  }

  private async publishError(
    message: IHermesMessage,
    event: ClassLike,
    view: IViewModel,
    error: DomainError,
  ): Promise<void> {
    try {
      this.logger.debug("Rejecting event", { event: message, view, error });

      await this.errorBus.publish(
        this.errorBus.create({
          data: {
            error: error.toJSON ? error.toJSON() : { ...error },
            event,
            message: message,
            view: { id: view.id, name: view.name, context: view.context },
          },
          aggregate: message.aggregate,
          causationId: message.id,
          correlationId: message.correlationId,
          mandatory: false,
          meta: message.meta,
          name: snakeCase(error.name),
        }),
      );

      this.logger.verbose("Rejected event", { event: message, view, error });
    } catch (err: any) {
      this.logger.warn("Failed to reject event", err);

      throw err;
    }
  }

  private emit<S extends Dict = Dict>(view: IViewModel<S>): void {
    const data: EventEmitterViewData<S> = {
      id: view.id,
      name: view.name,
      context: view.context,
      destroyed: view.destroyed,
      revision: view.revision,
      state: view.state,
    };

    this.eventEmitter.emit("view", data);
    this.eventEmitter.emit(`view.${view.context}`, data);
    this.eventEmitter.emit(`view.${view.context}.${view.name}`, data);
    this.eventEmitter.emit(`view.${view.context}.${view.name}.${view.id}`, data);
  }

  // private static

  private static getErrorQueue(handler: IViewErrorHandler): string {
    return `queue.view.${handler.aggregate.context}.${handler.aggregate.name}.${handler.error}.${handler.view.context}.${handler.view.name}`;
  }

  private static getErrorTopic(handler: IViewErrorHandler): string {
    return `${handler.aggregate.context}.${handler.aggregate.name}.${handler.error}`;
  }

  private static getEventQueue(handler: IViewEventHandler): string {
    return `queue.view.${handler.aggregate.context}.${handler.aggregate.name}.${handler.event.name}.${handler.view.context}.${handler.view.name}`;
  }

  private static getEventTopic(handler: IViewEventHandler): string {
    return `${handler.aggregate.context}.${handler.aggregate.name}.${handler.event.name}`;
  }
}
