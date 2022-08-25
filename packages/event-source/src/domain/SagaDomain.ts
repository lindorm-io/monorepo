import { DomainEvent, ErrorMessage, TimeoutMessage } from "../message";
import { HandlerIdentifier, ISagaEventHandler, SagaEventHandlerContext } from "../types";
import { ILogger } from "@lindorm-io/winston";
import { IMessageBus } from "@lindorm-io/amqp";
import { LindormError } from "@lindorm-io/errors";
import { MAX_PROCESSED_CAUSATION_IDS_LENGTH } from "../constant";
import { Saga } from "../entity";
import { SagaEventHandlerImplementation } from "../handler";
import { SagaIdentifier, ISagaDomain, SagaDomainOptions, State, IDomainSagaStore } from "../types";
import { assertSnakeCase } from "../util";
import { cloneDeep, find, isArray, isUndefined, some } from "lodash";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../error";

export class SagaDomain implements ISagaDomain {
  private readonly eventHandlers: Array<ISagaEventHandler>;
  private readonly logger: ILogger;
  private messageBus: IMessageBus;
  private store: IDomainSagaStore;

  public constructor(options: SagaDomainOptions, logger: ILogger) {
    this.logger = logger.createChildLogger(["SagaDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventHandlers = [];
  }

  public async registerEventHandler(eventHandler: SagaEventHandlerImplementation): Promise<void> {
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

    const contexts = isArray(eventHandler.aggregate.context)
      ? eventHandler.aggregate.context
      : [eventHandler.aggregate.context];

    for (const context of contexts) {
      const existingHandler = some(this.eventHandlers, {
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
      });

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
          context: context,
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

    const eventHandler = find(this.eventHandlers, {
      eventName: event.name,
      version: event.version,
      aggregate: {
        name: event.aggregate.name,
        context: event.aggregate.context,
      },
      saga: {
        name: sagaIdentifier.name,
        context: sagaIdentifier.context,
      },
    });

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
            isUndefined(eventHandler.conditions.permanent) ||
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
    } catch (err) {
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

      const context: SagaEventHandlerContext = {
        event: cloneDeep(event.data),
        logger: this.logger.createChildLogger(["SagaEventHandler"]),
        state: cloneDeep(saga.state),

        destroy: saga.destroy.bind(saga),
        dispatch: saga.dispatch.bind(saga, event),
        mergeState: saga.mergeState.bind(saga),
        timeout: saga.timeout.bind(saga, event),
      };

      await eventHandler.handler(context);

      const saved = await this.store.save(saga, event);

      this.logger.debug("Saved saga at new revision", {
        id: saved.id,
        name: saved.name,
        context: saved.context,
        revision: saved.revision,
      });

      return saved;
    } catch (err) {
      if (err instanceof DomainError && err.permanent) {
        this.logger.error("Failed to handle Saga", err);

        untouchedSaga.messagesToDispatch.push(
          new ErrorMessage(
            {
              name: err.name,
              aggregate: { id: saga.id, name: saga.name, context: saga.context },
              data: { error: err, message: event },
              mandatory: false,
              origin: "saga_domain",
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

  // private static

  private static getQueue(context: string, eventHandler: SagaEventHandlerImplementation): string {
    return `queue.saga.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.saga.context}.${eventHandler.saga.name}`;
  }

  private static getTopic(context: string, eventHandler: SagaEventHandlerImplementation): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
