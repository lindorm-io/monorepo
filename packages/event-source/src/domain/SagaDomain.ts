import EventEmitter from "events";
import clone from "clone";
import { DomainEvent, ErrorMessage, TimeoutMessage } from "../message";
import { IMessageBus } from "@lindorm-io/amqp";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/core-logger";
import { MAX_PROCESSED_CAUSATION_IDS_LENGTH } from "../constant";
import { Saga } from "../model";
import { SagaEventHandlerImplementation } from "../handler";
import {
  SagaIdentifier,
  ISagaDomain,
  SagaDomainOptions,
  State,
  IDomainSagaStore,
  Data,
  DtoClass,
} from "../types";
import { assertSnakeCase } from "../util";
import { snakeCase } from "@lindorm-io/case";
import {
  EventEmitterSagaData,
  EventEmitterListener,
  HandlerIdentifier,
  ISagaEventHandler,
  SagaEventHandlerContext,
} from "../types";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../error";

export class SagaDomain implements ISagaDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<ISagaEventHandler>;
  private readonly logger: Logger;
  private readonly messageBus: IMessageBus;
  private store: IDomainSagaStore;

  public constructor(options: SagaDomainOptions, logger: Logger) {
    this.eventEmitter = new EventEmitter();
    this.logger = logger.createChildLogger(["SagaDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventHandlers = [];
  }

  on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerEventHandler<T extends DtoClass = DtoClass>(
    eventHandler: SagaEventHandlerImplementation<T>,
  ): Promise<void> {
    this.logger.debug("Registering event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
      saga: eventHandler.saga,
    });

    if (!(eventHandler instanceof SagaEventHandlerImplementation)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "SagaEventHandler",
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

      assertSnakeCase(context);
      assertSnakeCase(eventHandler.aggregate.name);
      assertSnakeCase(eventHandler.saga.context);
      assertSnakeCase(eventHandler.saga.name);
      assertSnakeCase(eventHandler.eventName);

      this.eventHandlers.push(
        new SagaEventHandlerImplementation({
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

      await this.messageBus.subscribe({
        callback: (event: DomainEvent | TimeoutMessage) =>
          this.handleEvent(event, eventHandler.saga),
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

  public async inspect<TState extends State = State>(
    identifier: SagaIdentifier,
  ): Promise<Saga<TState>> {
    return (await this.store.load(identifier)) as Saga<TState>;
  }

  // private

  private async handleEvent(
    event: DomainEvent | TimeoutMessage,
    sagaIdentifier: HandlerIdentifier,
  ): Promise<void> {
    this.logger.debug("Handling event", { event, sagaIdentifier });

    const conditionValidators = [];

    const eventHandler = this.eventHandlers.find(
      (x) =>
        x.eventName === event.name &&
        x.version === event.version &&
        x.aggregate.name === event.aggregate.name &&
        x.aggregate.context === event.aggregate.context &&
        x.saga.name === sagaIdentifier.name &&
        x.saga.context === sagaIdentifier.context,
    );

    if (!(eventHandler instanceof SagaEventHandlerImplementation)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((saga: Saga) => {
      if (saga.destroyed) {
        throw new SagaDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((saga: Saga) => {
        if (saga.revision < 1) {
          throw new SagaNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((saga: Saga) => {
        if (saga.revision > 0) {
          throw new SagaAlreadyCreatedError(
            eventHandler.conditions.permanent === undefined ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const identifier: SagaIdentifier = {
      id: eventHandler.getSagaId(event),
      name: sagaIdentifier.name,
      context: sagaIdentifier.context,
    };

    let saga: Saga = await this.store.load(identifier);

    this.logger.debug("Saga loaded", { saga: saga.toJSON() });

    const exists = await this.store.causationExists(identifier, event);

    this.logger.debug("Causation exists", { exists });

    try {
      if (!exists && !saga.processedCausationIds.includes(event.id)) {
        saga = await this.handleSaga(saga, event, eventHandler, conditionValidators);
      }

      saga = await this.publishCommands(saga);
      saga = await this.processCausationIds(saga);

      this.logger.verbose("Handled event", { event, saga: saga.toJSON() });
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
    saga: Saga,
    event: DomainEvent | TimeoutMessage,
    eventHandler: SagaEventHandlerImplementation,
    conditionValidators: Array<(saga: Saga) => void>,
  ): Promise<Saga> {
    const json = saga.toJSON();

    this.logger.debug("Handling Saga", { saga: json, event });

    const untouchedSaga = new Saga(json, this.logger);

    try {
      for (const validator of conditionValidators) {
        validator(saga);
      }

      const ctx: SagaEventHandlerContext = {
        event: clone(event.data),
        logger: this.logger.createChildLogger(["SagaEventHandler"]),
        state: clone(saga.state),

        destroy: saga.destroy.bind(saga),
        dispatch: saga.dispatch.bind(saga, event),
        mergeState: saga.mergeState.bind(saga),
        setState: saga.setState.bind(saga),
        timeout: saga.timeout.bind(saga, event),
      };

      await eventHandler.handler(ctx);

      const saved = await this.store.save(saga, event);

      this.emit(saved);

      this.logger.debug("Saved saga at new revision", {
        id: saved.id,
        name: saved.name,
        context: saved.context,
        revision: saved.revision,
      });

      return saved;
    } catch (err: any) {
      if (err instanceof DomainError && err.permanent) {
        this.logger.error("Failed to handle Saga", err);

        untouchedSaga.messagesToDispatch.push(
          new ErrorMessage(
            {
              name: snakeCase(err.name),
              aggregate: event.aggregate,
              data: {
                error: err,
                message: event,
                saga: { id: saga.id, name: saga.name, context: saga.context },
              },
              metadata: event.metadata,
              mandatory: false,
            },
            event,
          ),
        );

        return untouchedSaga;
      }

      throw err;
    }
  }

  private async publishCommands(saga: Saga): Promise<Saga> {
    if (!saga.messagesToDispatch.length) {
      return saga;
    }

    await this.messageBus.publish(saga.messagesToDispatch);

    this.logger.debug("Published commands for saga", {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      messagesToDispatch: saga.messagesToDispatch,
    });

    if (saga.revision === 0) {
      return saga;
    }

    return await this.store.clearMessagesToDispatch(saga);
  }

  private async processCausationIds(saga: Saga): Promise<Saga> {
    if (saga.processedCausationIds.length < MAX_PROCESSED_CAUSATION_IDS_LENGTH) {
      return saga;
    }

    this.logger.debug("Processing causation ids for saga", {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      processedCausationIds: saga.processedCausationIds,
    });

    await this.store.processCausationIds(saga);
    return await this.store.clearProcessedCausationIds(saga);
  }

  private emit<TState extends State = State>(saga: Saga<TState>): void {
    const data: EventEmitterSagaData<TState> = {
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

  private static getQueue(context: string, eventHandler: ISagaEventHandler): string {
    return `queue.saga.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.saga.context}.${eventHandler.saga.name}`;
  }

  private static getTopic(context: string, eventHandler: ISagaEventHandler): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
