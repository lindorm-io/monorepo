import { snakeCase } from "@lindorm/case";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import EventEmitter from "events";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../errors";
import { HermesSagaEventHandler } from "../handlers";
import {
  IHermesMessageBus,
  IHermesSagaEventHandler,
  IHermesSagaStore,
  ISaga,
  ISagaDomain,
} from "../interfaces";
import { HermesCommand, HermesError, HermesEvent, HermesTimeout } from "../messages";
import { Saga } from "../models";
import {
  HandlerIdentifier,
  SagaDomainOptions,
  SagaEventHandlerContext,
  SagaIdentifier,
} from "../types";
import { EventEmitterListener, EventEmitterSagaData } from "../types/event-emitter";

export class SagaDomain implements ISagaDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<IHermesSagaEventHandler>;
  private readonly logger: ILogger;
  private readonly commandBus: IHermesMessageBus;
  private readonly errorBus: IHermesMessageBus;
  private readonly eventBus: IHermesMessageBus;
  private readonly timeoutBus: IHermesMessageBus;
  private store: IHermesSagaStore;

  public constructor(options: SagaDomainOptions) {
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.child(["SagaDomain"]);

    this.commandBus = options.commandBus;
    this.errorBus = options.errorBus;
    this.eventBus = options.eventBus;
    this.timeoutBus = options.timeoutBus;
    this.store = options.store;

    this.eventHandlers = [];
  }

  public on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerEventHandler<T extends ClassLike = ClassLike>(
    eventHandler: IHermesSagaEventHandler<T>,
  ): Promise<void> {
    this.logger.debug("Registering event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
      saga: eventHandler.saga,
    });

    if (!(eventHandler instanceof HermesSagaEventHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: HermesSagaEventHandler.name,
          actual: typeof eventHandler,
        },
      });
    }

    const contexts = Array.isArray(eventHandler.aggregate.context)
      ? eventHandler.aggregate.context
      : [eventHandler.aggregate.context];

    for (const context of contexts) {
      const existingHandler = this.eventHandlers.some(
        (x) =>
          x.eventName === eventHandler.eventName &&
          x.version === eventHandler.version &&
          x.aggregate.name === eventHandler.aggregate.name &&
          x.aggregate.context === context &&
          x.saga.name === eventHandler.saga.name &&
          x.saga.context === eventHandler.saga.context,
      );

      if (existingHandler) {
        throw new LindormError("Event handler has already been registered", {
          debug: {
            eventName: eventHandler.eventName,
            version: eventHandler.version,
            aggregate: {
              name: eventHandler.aggregate.name,
              context: eventHandler.aggregate.context,
            },
            saga: {
              name: eventHandler.saga.name,
              context: eventHandler.saga.context,
            },
          },
        });
      }

      this.eventHandlers.push(
        new HermesSagaEventHandler({
          eventName: eventHandler.eventName,
          aggregate: {
            name: eventHandler.aggregate.name,
            context,
          },
          conditions: eventHandler.conditions,
          getSagaId: eventHandler.getSagaId,
          handler: eventHandler.handler,
          saga: eventHandler.saga,
        }),
      );

      await this.eventBus.subscribe({
        callback: (event: HermesEvent) => this.handleEvent(event, eventHandler.saga),
        queue: SagaDomain.getQueue(context, eventHandler),
        topic: SagaDomain.getTopic(context, eventHandler),
      });

      this.logger.verbose("Event handler registered", {
        eventName: eventHandler.eventName,
        aggregate: {
          name: eventHandler.aggregate.name,
          context,
        },
        saga: eventHandler.saga,
      });
    }
  }

  public async inspect<S extends Dict = Dict>(
    sagaIdentifier: SagaIdentifier,
  ): Promise<ISaga<S>> {
    return (await this.store.load(sagaIdentifier)) as ISaga<S>;
  }

  // private

  private async handleEvent(
    event: HermesEvent,
    handlerIdentifier: HandlerIdentifier,
  ): Promise<void> {
    this.logger.debug("Handling event", { event, sagaIdentifier: handlerIdentifier });

    const conditionValidators = [];

    const eventHandler = this.eventHandlers.find(
      (x) =>
        x.eventName === event.name &&
        x.version === event.version &&
        x.aggregate.name === event.aggregate.name &&
        x.aggregate.context === event.aggregate.context &&
        x.saga.name === handlerIdentifier.name &&
        x.saga.context === handlerIdentifier.context,
    );

    if (!(eventHandler instanceof HermesSagaEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((saga: ISaga) => {
      if (saga.destroyed) {
        throw new SagaDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((saga: ISaga) => {
        if (saga.revision < 1) {
          throw new SagaNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((saga: ISaga) => {
        if (saga.revision > 0) {
          throw new SagaAlreadyCreatedError(
            eventHandler.conditions.permanent === undefined ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const sagaIdentifier: SagaIdentifier = {
      id: eventHandler.getSagaId(event),
      name: handlerIdentifier.name,
      context: handlerIdentifier.context,
    };

    const data = await this.store.load(sagaIdentifier);

    let saga: ISaga = new Saga({
      ...data,
      commandBus: this.commandBus,
      timeoutBus: this.timeoutBus,
      logger: this.logger,
    });

    this.logger.debug("Saga loaded", { saga: saga.toJSON() });

    const causations = await this.store.loadCausations(sagaIdentifier);

    const causationExists =
      causations.includes(event.id) || saga.processedCausationIds.includes(event.id);

    this.logger.debug("Causation exists", { causationExists });

    try {
      if (!causationExists) {
        saga = await this.handleSaga(saga, event, eventHandler, conditionValidators);
      }

      saga = await this.publishMessages(saga);
      saga = await this.processCausationIds(saga);

      this.logger.verbose("Handled event", { event, saga: saga.toJSON() });

      this.emit(saga);
    } catch (err: any) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling event", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling event", err);
      } else {
        this.logger.error("Failed to handle event", err);
      }

      throw err;
    }
  }

  private async handleSaga(
    saga: ISaga,
    event: HermesEvent,
    eventHandler: IHermesSagaEventHandler,
    conditionValidators: Array<(saga: ISaga) => void>,
  ): Promise<ISaga> {
    const json = saga.toJSON();

    this.logger.debug("Handling Saga", { saga: json, event });

    const untouchedSaga = new Saga({
      ...json,
      commandBus: this.commandBus,
      timeoutBus: this.timeoutBus,
      logger: this.logger,
    });

    try {
      for (const validator of conditionValidators) {
        validator(saga);
      }

      const ctx: SagaEventHandlerContext = {
        event: structuredClone(event.data),
        logger: this.logger.child(["SagaEventHandler"]),
        state: structuredClone(saga.state),

        destroy: saga.destroy.bind(saga),
        dispatch: saga.dispatch.bind(saga, event),
        mergeState: saga.mergeState.bind(saga),
        setState: saga.setState.bind(saga),
        timeout: saga.timeout.bind(saga, event),
      };

      await eventHandler.handler(ctx);

      const data = await this.store.save(saga, event);

      const saved = new Saga({
        ...data,
        commandBus: this.commandBus,
        timeoutBus: this.timeoutBus,
        logger: this.logger,
      });

      this.logger.debug("Saved saga at new revision", {
        saga: saved.toJSON(),
      });

      return saved;
    } catch (err: any) {
      this.logger.error("Failed to handle Saga", err);

      if (!(err instanceof DomainError) || !err.permanent) {
        throw err;
      }

      untouchedSaga.messagesToDispatch.push(
        this.errorBus.create({
          data: {
            error: err,
            message: event,
            saga: { id: saga.id, name: saga.name, context: saga.context },
          },
          aggregate: event.aggregate,
          causationId: event.id,
          correlationId: event.correlationId,
          mandatory: false,
          meta: event.meta,
          name: snakeCase(err.name),
        }),
      );

      return untouchedSaga;
    }
  }

  private async publishMessages(saga: ISaga): Promise<ISaga> {
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
      context: saga.context,
      messagesToDispatch: saga.messagesToDispatch,
    });

    if (saga.revision === 0) {
      this.logger.debug("Saga is new, returning without clearing messages");
      return saga;
    }

    const data = await this.store.clearMessages(saga);

    return new Saga({
      ...data,
      commandBus: this.commandBus,
      timeoutBus: this.timeoutBus,
      logger: this.logger,
    });
  }

  private async processCausationIds(saga: ISaga): Promise<ISaga> {
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
      context: saga.context,
      processedCausationIds: saga.processedCausationIds,
    });

    const data = await this.store.saveCausations(saga);

    return new Saga({
      ...data,
      commandBus: this.commandBus,
      timeoutBus: this.timeoutBus,
      logger: this.logger,
    });
  }

  private emit<S extends Dict = Dict>(saga: ISaga<S>): void {
    const data: EventEmitterSagaData<S> = {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      destroyed: saga.destroyed,
      state: saga.state,
    };

    this.eventEmitter.emit("saga", data);
    this.eventEmitter.emit(`saga.${saga.context}`, data);
    this.eventEmitter.emit(`saga.${saga.context}.${saga.name}`, data);
    this.eventEmitter.emit(`saga.${saga.context}.${saga.name}.${saga.id}`, data);
  }

  // private static

  private static getQueue(
    context: string,
    eventHandler: IHermesSagaEventHandler,
  ): string {
    return `queue.saga.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.saga.context}.${eventHandler.saga.name}`;
  }

  private static getTopic(
    context: string,
    eventHandler: IHermesSagaEventHandler,
  ): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
