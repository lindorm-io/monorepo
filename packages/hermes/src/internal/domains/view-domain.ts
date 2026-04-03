import { snakeCase } from "@lindorm/case";
import type { ILogger } from "@lindorm/logger";
import type { IIrisMessageBus, IIrisWorkerQueue } from "@lindorm/iris";
import { OptimisticLockError } from "@lindorm/proteus";
import type { IProteusSource } from "@lindorm/proteus";
import type { ClassLike, Constructor, Dict } from "@lindorm/types";
import EventEmitter from "events";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../../errors";
import type { ErrorDispatchOptions } from "../../types";
import type { HermesViewEntity } from "../../entities/HermesViewEntity";
import type { HermesRegistry } from "#internal/registry";
import type { HandlerRegistration, RegisteredView } from "#internal/registry/types";
import { CausationRecord } from "#internal/entities";
import type {
  HermesCommandMessage,
  HermesErrorMessage,
  HermesEventMessage,
} from "#internal/messages";
import { causationExists } from "#internal/stores";
import { applyUpcasters } from "#internal/utils";

export type ViewDomainOptions = {
  registry: HermesRegistry;
  proteusSource: IProteusSource;
  viewSources: Map<string, IProteusSource>;
  eventBus: IIrisMessageBus<HermesEventMessage>;
  commandQueue: IIrisWorkerQueue<HermesCommandMessage>;
  errorQueue: IIrisWorkerQueue<HermesErrorMessage>;
  causationExpiryMs: number;
  logger: ILogger;
};

type EventEmitterViewData = {
  id: string;
  name: string;
  namespace: string;
  destroyed: boolean;
  revision: number;
};

export class ViewDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly logger: ILogger;
  private readonly registry: HermesRegistry;
  private readonly proteusSource: IProteusSource;
  private readonly viewSources: Map<string, IProteusSource>;
  private readonly eventBus: IIrisMessageBus<HermesEventMessage>;
  private readonly commandQueue: IIrisWorkerQueue<HermesCommandMessage>;
  private readonly errorQueue: IIrisWorkerQueue<HermesErrorMessage>;
  private readonly causationExpiryMs: number;

  public constructor(options: ViewDomainOptions) {
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.child(["ViewDomain"]);
    this.registry = options.registry;
    this.proteusSource = options.proteusSource;
    this.viewSources = options.viewSources;
    this.eventBus = options.eventBus;
    this.commandQueue = options.commandQueue;
    this.errorQueue = options.errorQueue;
    this.causationExpiryMs = options.causationExpiryMs;
  }

  public on(evt: string, listener: (data: EventEmitterViewData) => void): void {
    this.eventEmitter.on(evt, listener);
  }

  public off(evt: string, listener: (data: EventEmitterViewData) => void): void {
    this.eventEmitter.off(evt, listener);
  }

  public removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }

  public async registerHandlers(): Promise<void> {
    for (const view of this.registry.allViews) {
      await this.registerViewEventHandlers(view);
    }
  }

  public async inspect<V extends HermesViewEntity>(
    id: string,
    entity: Constructor<V>,
  ): Promise<V | null> {
    const view = this.registry.getViewByEntity(entity as unknown as Constructor);
    const source = this.resolveSource(view);
    const repo = source.repository(entity);
    return repo.findOne({ id } as any);
  }

  public async query<R>(queryDto: ClassLike): Promise<R> {
    this.logger.debug("Handling query", { query: queryDto });

    const meta = this.registry.getQuery(queryDto.constructor);

    const view = this.findViewForQuery(meta.name);
    if (!view) {
      throw new HandlerNotRegisteredError();
    }

    const queryHandler = view.queryHandlers.find((h) => {
      const dto = this.registry.getQuery(h.trigger);
      return dto.name === meta.name;
    });

    if (!queryHandler) {
      throw new HandlerNotRegisteredError();
    }

    const source = this.resolveSource(view);
    const repo = source.repository(view.entity);

    const instance = new view.target();
    const handlerFn = instance[queryHandler.methodName];

    if (typeof handlerFn !== "function") {
      throw new HandlerNotRegisteredError();
    }

    const ctx = {
      query: structuredClone(queryDto),
      logger: this.logger.child(["QueryHandler"]),
      repository: repo,
    };

    return handlerFn.call(instance, ctx) as Promise<R>;
  }

  // -- Replay support --

  public async replayEvent(
    message: HermesEventMessage,
    view: RegisteredView,
  ): Promise<void> {
    let handler = this.findHandlerForEvent(message, view);
    let eventData = message.data;

    if (!handler) {
      handler = this.findHandlerForEventByName(message.name, view);

      if (!handler) {
        this.logger.debug("No handler for event during replay, skipping", {
          event: message.name,
          view: { name: view.name, namespace: view.namespace },
        });
        return;
      }

      const handlerDto = this.registry.getEvent(handler.trigger);

      if (message.version > handlerDto.version) {
        this.logger.debug(
          "Event version exceeds handler version during replay, skipping",
          {
            event: message.name,
            eventVersion: message.version,
            handlerVersion: handlerDto.version,
            view: { name: view.name, namespace: view.namespace },
          },
        );
        return;
      }

      if (message.version < handlerDto.version) {
        this.logger.debug("Upcasting event during replay", {
          event: message.name,
          from: message.version,
          to: handlerDto.version,
          view: { name: view.name, namespace: view.namespace },
        });

        const aggregate = this.registry.getAggregate(
          message.aggregate.namespace,
          message.aggregate.name,
        );
        const chain = this.registry.getUpcasterChain(
          message.name,
          message.version,
          handlerDto.version,
        );
        eventData = applyUpcasters(aggregate, chain, message.data);
      }
    }

    const event = this.hydrateDto(handler.trigger, eventData);
    const viewId = this.resolveViewId(message, event, view);

    const source = this.resolveSource(view);
    const viewRepo = source.repository(view.entity);

    const existingEntity = await viewRepo.findOne({ id: viewId } as any);
    const isNew = !existingEntity;
    const entity = existingEntity ?? viewRepo.create({ id: viewId } as any);

    this.validateViewConditions(entity, handler, isNew);

    const ctx = {
      event,
      entity,
      logger: this.logger.child(["ReplayEventHandler"]),
      meta: message.meta,
      destroy: () => {
        (entity as any).destroyed = true;
      },
    };

    const instance = new view.target();
    const handlerFn = instance[handler.methodName];

    if (typeof handlerFn !== "function") {
      throw new HandlerNotRegisteredError();
    }

    await handlerFn.call(instance, ctx);

    if (isNew) {
      await viewRepo.insert(entity);
    } else {
      await viewRepo.update(entity);
    }
  }

  public getSubscriptionTopicsForView(
    view: RegisteredView,
  ): Array<{ topic: string; queue: string }> {
    const topics: Array<{ topic: string; queue: string }> = [];

    for (const handler of view.eventHandlers) {
      const eventDto = this.registry.getEvent(handler.trigger);
      const aggregate = this.registry.getAggregateForEvent(
        handler.trigger,
        view.aggregates,
      );
      topics.push({
        topic: `${aggregate.namespace}.${aggregate.name}.${eventDto.name}`,
        queue: `queue.view.${view.namespace}.${view.name}.${eventDto.name}`,
      });
    }

    return topics;
  }

  // -- Registration --

  private async registerViewEventHandlers(view: RegisteredView): Promise<void> {
    for (const handler of view.eventHandlers) {
      const eventDto = this.registry.getEvent(handler.trigger);
      const aggregate = this.registry.getAggregateForEvent(
        handler.trigger,
        view.aggregates,
      );

      const topic = `${aggregate.namespace}.${aggregate.name}.${eventDto.name}`;
      const queue = `queue.view.${view.namespace}.${view.name}.${eventDto.name}`;

      this.logger.debug("Registering view event handler", {
        view: { name: view.name, namespace: view.namespace },
        aggregate: { name: aggregate.name, namespace: aggregate.namespace },
        event: { name: eventDto.name, version: eventDto.version },
        topic,
        queue,
      });

      await this.eventBus.subscribe({
        topic,
        queue,
        callback: async (message) => this.handleEvent(message, view, handler),
      });

      this.logger.verbose("View event handler registered", {
        view: { name: view.name, namespace: view.namespace },
        event: { name: eventDto.name, version: eventDto.version },
      });
    }
  }

  // -- Event handling --

  private async handleEvent(
    message: HermesEventMessage,
    view: RegisteredView,
    handler: HandlerRegistration,
  ): Promise<void> {
    this.logger.debug("Handling view event", {
      messageId: message.id,
      view: { name: view.name, namespace: view.namespace },
    });

    let eventData = message.data;

    const handlerDto = this.registry.getEvent(handler.trigger);
    if (message.version !== handlerDto.version) {
      if (message.version > handlerDto.version) {
        this.logger.debug("Event version exceeds handler version, skipping", {
          event: message.name,
          eventVersion: message.version,
          handlerVersion: handlerDto.version,
          view: { name: view.name, namespace: view.namespace },
        });
        return;
      }

      this.logger.debug("Upcasting event for view", {
        event: message.name,
        from: message.version,
        to: handlerDto.version,
        view: { name: view.name, namespace: view.namespace },
      });

      const aggregate = this.registry.getAggregate(
        message.aggregate.namespace,
        message.aggregate.name,
      );
      const chain = this.registry.getUpcasterChain(
        message.name,
        message.version,
        handlerDto.version,
      );
      eventData = applyUpcasters(aggregate, chain, message.data);
    }

    const event = this.hydrateDto(handler.trigger, eventData);
    const viewId = this.resolveViewId(message, event, view);

    const source = this.resolveSource(view);
    const viewRepo = source.repository(view.entity);
    const causationSource = source === this.proteusSource ? this.proteusSource : source;
    const causationRepo = causationSource.repository(CausationRecord);

    const ownerName = `${view.namespace}.${view.name}`;

    const isDuplicate = await causationExists(
      causationRepo,
      viewId,
      ownerName,
      message.id,
    );

    if (isDuplicate) {
      this.logger.debug("View causation already processed, skipping", {
        viewId,
        causationId: message.id,
      });
      return;
    }

    const existingEntity = await viewRepo.findOne({ id: viewId } as any);
    const isNew = !existingEntity;
    const entity = existingEntity ?? viewRepo.create({ id: viewId } as any);

    try {
      this.validateViewConditions(entity, handler, isNew);

      const ctx = {
        event,
        entity,
        logger: this.logger.child(["ViewEventHandler"]),
        meta: message.meta,
        destroy: () => {
          (entity as any).destroyed = true;
        },
      };

      const instance = new view.target();
      const handlerFn = instance[handler.methodName];

      if (typeof handlerFn !== "function") {
        throw new HandlerNotRegisteredError();
      }

      await handlerFn.call(instance, ctx);

      try {
        await this.saveViewWithCausation(
          source,
          entity,
          isNew,
          viewId,
          ownerName,
          message.id,
        );
      } catch (saveErr: unknown) {
        if (saveErr instanceof OptimisticLockError) {
          throw new ConcurrencyError("View update failed due to optimistic lock", {
            data: { viewId, ownerName },
          });
        }
        throw saveErr;
      }

      this.logger.verbose("Handled view event", {
        messageId: message.id,
        view: { name: view.name, namespace: view.namespace },
        viewId,
      });

      this.emitView(entity, view);
    } catch (err: unknown) {
      await this.handleViewError(err, message, view, entity);
    }
  }

  // -- ID resolution --

  private resolveViewId(
    message: HermesEventMessage,
    event: ClassLike,
    view: RegisteredView,
  ): string {
    const idHandler = view.idHandlers.find((h) => {
      const eventDto = this.registry.getEvent(h.trigger);
      return eventDto.name === message.name && eventDto.version === message.version;
    });

    if (!idHandler) {
      return message.aggregate.id;
    }

    const instance = new view.target();
    const idFn = instance[idHandler.methodName];

    if (typeof idFn !== "function") {
      return message.aggregate.id;
    }

    return idFn.call(instance, {
      event,
      aggregate: message.aggregate,
      logger: this.logger.child(["ViewIdHandler"]),
    });
  }

  // -- Condition validation --

  private validateViewConditions(
    entity: HermesViewEntity,
    handler: HandlerRegistration,
    isNew: boolean,
  ): void {
    if (entity.destroyed) {
      throw new ViewDestroyedError();
    }

    if (handler.conditions.requireCreated && isNew) {
      throw new ViewNotCreatedError(true);
    }

    if (handler.conditions.requireNotCreated && !isNew) {
      throw new ViewAlreadyCreatedError(true);
    }
  }

  // -- Persistence --

  private async saveViewWithCausation(
    source: IProteusSource,
    entity: HermesViewEntity,
    isNew: boolean,
    ownerId: string,
    ownerName: string,
    causationId: string,
  ): Promise<void> {
    await source.transaction(async (tx) => {
      const txViewRepo = tx.repository(
        entity.constructor as Constructor<HermesViewEntity>,
      );
      const txCausationRepo = tx.repository(CausationRecord);

      if (isNew) {
        await txViewRepo.insert(entity);
      } else {
        await txViewRepo.update(entity);
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
  }

  // -- Source resolution --

  private resolveSource(view: RegisteredView): IProteusSource {
    if (!view.driverType) {
      return this.proteusSource;
    }

    const source = this.viewSources.get(view.driverType);
    if (!source) {
      throw new Error(
        `No ProteusSource found for driver type "${view.driverType}" (required by view "${view.namespace}.${view.name}")`,
      );
    }
    return source;
  }

  // -- Query lookup --

  private findViewForQuery(queryName: string): RegisteredView | undefined {
    for (const view of this.registry.allViews) {
      for (const handler of view.queryHandlers) {
        const dto = this.registry.getQuery(handler.trigger);
        if (dto.name === queryName) {
          return view;
        }
      }
    }
    return undefined;
  }

  // -- Error handling --

  private async handleViewError(
    err: unknown,
    message: HermesEventMessage,
    view: RegisteredView,
    entity: HermesViewEntity,
  ): Promise<void> {
    if (err instanceof ConcurrencyError) {
      this.logger.warn("Transient concurrency error while handling view event", err);
      throw err;
    }

    if (err instanceof DomainError) {
      this.logger.warn("Domain error while handling view event", err);

      if (err.permanent) {
        try {
          await this.publishError(message, view, entity, err);
        } catch (pubErr) {
          this.logger.error("Failed to publish view error", pubErr as Error);
          throw err;
        }

        await this.tryErrorHandler(err, view, entity, message);
        return;
      }

      throw err;
    }

    this.logger.error("Failed to handle view event", err as Error);
    throw err;
  }

  private async tryErrorHandler(
    err: Error,
    view: RegisteredView,
    entity: HermesViewEntity,
    message: HermesEventMessage,
  ): Promise<void> {
    if (!view.errorHandlers.length) {
      return;
    }

    const errorHandler = view.errorHandlers.find((h) => err instanceof h.trigger);

    if (!errorHandler) {
      return;
    }

    const instance = new view.target();
    const handlerFn = instance[errorHandler.methodName];

    if (typeof handlerFn !== "function") {
      return;
    }

    const dispatched: Array<{ command: ClassLike; options: ErrorDispatchOptions }> = [];

    const ctx = {
      error: err,
      entity,
      logger: this.logger.child(["ViewErrorHandler"]),
      dispatch: (command: ClassLike, options?: ErrorDispatchOptions) => {
        dispatched.push({ command, options: options ?? {} });
      },
    };

    await handlerFn.call(instance, ctx);

    for (const { command, options } of dispatched) {
      await this.dispatchCommandFromError(message, command, options);
    }
  }

  private async dispatchCommandFromError(
    causation: HermesEventMessage,
    command: ClassLike,
    options: ErrorDispatchOptions = {},
  ): Promise<void> {
    const metadata = this.registry.getCommand(command.constructor);
    const commandHandler = this.registry.getCommandHandler(
      command.constructor as Constructor,
    );

    if (!commandHandler) {
      throw new HandlerNotRegisteredError();
    }

    const { ...data } = command;

    const msg = this.commandQueue.create({
      aggregate: {
        id: options.id ?? causation.aggregate.id,
        name: commandHandler.aggregate.name,
        namespace: commandHandler.aggregate.namespace,
      },
      causationId: causation.id,
      correlationId: causation.correlationId,
      data,
      meta: options.meta ? { ...causation.meta, ...options.meta } : causation.meta,
      name: metadata.name,
      version: metadata.version,
    });

    if (options.mandatory !== undefined) {
      msg.mandatory = options.mandatory;
    }

    if (options.delay) {
      await this.commandQueue.publish(msg, { delay: options.delay });
    } else {
      await this.commandQueue.publish(msg);
    }
  }

  private async publishError(
    causation: HermesEventMessage,
    view: RegisteredView,
    entity: HermesViewEntity,
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
        view: { id: entity.id, name: view.name, namespace: view.namespace },
      },
      meta: causation.meta,
      name: snakeCase(error.name),
    });
    errorMessage.mandatory = false;

    this.logger.debug("Publishing view error", {
      causation: causation.id,
      error: error.name,
      view: { name: view.name, namespace: view.namespace },
    });

    await this.errorQueue.publish(errorMessage);

    this.logger.verbose("Published view error", {
      causation: causation.id,
      error: error.name,
    });
  }

  // -- EventEmitter --

  private emitView(entity: HermesViewEntity, view: RegisteredView): void {
    const data: EventEmitterViewData = {
      id: entity.id,
      name: view.name,
      namespace: view.namespace,
      destroyed: entity.destroyed,
      revision: entity.revision,
    };

    this.eventEmitter.emit("view", data);
    this.eventEmitter.emit(`view.${view.namespace}`, data);
    this.eventEmitter.emit(`view.${view.namespace}.${view.name}`, data);
    this.eventEmitter.emit(`view.${view.namespace}.${view.name}.${entity.id}`, data);
  }

  // -- Handler lookup --

  private findHandlerForEvent(
    message: HermesEventMessage,
    view: RegisteredView,
  ): HandlerRegistration | undefined {
    return view.eventHandlers.find((h) => {
      const eventDto = this.registry.getEvent(h.trigger);
      return eventDto.name === message.name && eventDto.version === message.version;
    });
  }

  private findHandlerForEventByName(
    eventName: string,
    view: RegisteredView,
  ): HandlerRegistration | undefined {
    return view.eventHandlers.find((h) => {
      const eventDto = this.registry.getEvent(h.trigger);
      return eventDto.name === eventName;
    });
  }

  // -- DTO hydration --

  private hydrateDto(target: { new (): any }, data: Dict): ClassLike {
    const instance = new target();
    Object.assign(instance, data);
    return instance;
  }
}
