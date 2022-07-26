import { DomainEvent, TimeoutEvent } from "../message";
import { HandlerIdentifier, SagaEventHandlerContext } from "../types";
import { ISagaDomain, SagaDomainOptions } from "../types";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { MessageBus, SagaStore } from "../infrastructure";
import { Saga } from "../entity";
import { SagaEventHandler } from "../handler";
import { assertSnakeCase } from "../util";
import { find, findLast, isArray, isUndefined, remove, some } from "lodash";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  SagaAlreadyCreatedError,
  SagaDestroyedError,
  SagaNotCreatedError,
} from "../error";

export class SagaDomain implements ISagaDomain {
  private readonly eventHandlers: Array<SagaEventHandler>;
  private readonly logger: Logger;
  private messageBus: MessageBus;
  private store: SagaStore;

  public constructor(options: SagaDomainOptions) {
    this.logger = options.logger.createChildLogger(["SagaDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventHandlers = [];
  }

  public async registerEventHandler(eventHandler: SagaEventHandler): Promise<void> {
    this.logger.debug("Registering event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
      saga: eventHandler.saga,
    });

    if (!(eventHandler instanceof SagaEventHandler)) {
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
        throw new LindormError("Event handler has already been registered");
      }

      assertSnakeCase(context);
      assertSnakeCase(eventHandler.aggregate.name);
      assertSnakeCase(eventHandler.saga.context);
      assertSnakeCase(eventHandler.saga.name);
      assertSnakeCase(eventHandler.eventName);

      this.eventHandlers.push(
        new SagaEventHandler({
          eventName: eventHandler.eventName,
          aggregate: {
            name: eventHandler.aggregate.name,
            context,
          },
          conditions: eventHandler.conditions,
          getSagaId: eventHandler.getSagaId,
          handler: eventHandler.handler,
          saga: eventHandler.saga,
          saveOptions: eventHandler.saveOptions,
        }),
      );

      await this.messageBus.subscribe({
        callback: (event: DomainEvent | TimeoutEvent) => this.handleEvent(event, eventHandler.saga),
        queue: SagaDomain.getQueue(context, eventHandler),
        routingKey: SagaDomain.getRoutingKey(context, eventHandler),
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

  public async removeEventHandler(eventHandler: SagaEventHandler): Promise<void> {
    this.logger.debug("Removing event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
      saga: eventHandler.saga,
    });

    if (!(eventHandler instanceof SagaEventHandler)) {
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
      remove(this.eventHandlers, {
        eventName: eventHandler.eventName,
        aggregate: {
          name: eventHandler.aggregate.name,
          context: eventHandler.aggregate.context,
        },
        saga: {
          name: eventHandler.saga.name,
          context: eventHandler.saga.context,
        },
      });

      await this.messageBus.unsubscribe({
        queue: SagaDomain.getQueue(context, eventHandler),
        routingKey: SagaDomain.getRoutingKey(context, eventHandler),
      });

      this.logger.verbose("Event handler removed", {
        eventName: eventHandler.eventName,
        aggregate: {
          name: eventHandler.aggregate.name,
          context: context,
        },
        saga: eventHandler.saga,
      });
    }
  }

  public async removeAllEventHandlers(): Promise<void> {
    for (const handler of this.eventHandlers) {
      await this.removeEventHandler(handler);
    }
  }

  // private

  private async handleEvent(
    event: DomainEvent | TimeoutEvent,
    sagaIdentifier: HandlerIdentifier,
  ): Promise<void> {
    this.logger.debug("Handling event", { event, sagaIdentifier });

    const conditionValidators = [];

    const eventHandler = find(this.eventHandlers, {
      eventName: event.name,
      aggregate: {
        name: event.aggregate.name,
        context: event.aggregate.context,
      },
      saga: {
        name: sagaIdentifier.name,
        context: sagaIdentifier.context,
      },
    });

    if (!(eventHandler instanceof SagaEventHandler)) {
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

    const saga = await this.store.load({
      id: eventHandler.getSagaId(event),
      name: sagaIdentifier.name,
      context: sagaIdentifier.context,
    });

    this.logger.debug("Saga identified", {
      id: saga.id,
      name: saga.name,
      context: saga.context,
      causationList: saga.causationList,
      messagesToDispatch: saga.messagesToDispatch,
      revision: saga.revision,
      state: saga.state,
    });

    const lastCausationMatchesEventId = findLast(
      saga.causationList,
      (causationId) => causationId === event.id,
    );

    try {
      if (!lastCausationMatchesEventId) {
        const savedSaga = await this.handleSaga(saga, event, eventHandler, conditionValidators);

        await this.publishCommands(savedSaga);

        this.logger.debug("Published commands for saved saga at new revision", {
          id: savedSaga.id,
          name: savedSaga.name,
          context: savedSaga.context,
          causationList: savedSaga.causationList,
          messagesToDispatch: savedSaga.messagesToDispatch,
          revision: savedSaga.revision,
          state: savedSaga.state,
        });
      } else {
        await this.publishCommands(saga);

        this.logger.debug("Published commands for saga at same revision", {
          id: saga.id,
          name: saga.name,
          context: saga.context,
          causationList: saga.causationList,
          messagesToDispatch: saga.messagesToDispatch,
          revision: saga.revision,
          state: saga.state,
        });
      }

      this.logger.verbose("Handled event", { event, sagaIdentifier });
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
    event: DomainEvent | TimeoutEvent,
    eventHandler: SagaEventHandler,
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
        event,
        logger: this.logger.createChildLogger(["SagaEventHandler"]),

        destroy: saga.destroy.bind(saga),
        dispatch: saga.dispatch.bind(saga, event),
        getState: saga.getState.bind(saga),
        mergeState: saga.mergeState.bind(saga),
        setState: saga.setState.bind(saga),
        timeout: saga.timeout.bind(saga, event),
      };

      await eventHandler.handler(context);

      this.logger.debug("Messages to dispatch", {
        messagesToDispatch: saga.messagesToDispatch,
      });

      return await this.store.save(saga, event, eventHandler.saveOptions);
    } catch (err) {
      if (err instanceof DomainError && err.permanent) {
        this.logger.error("Failed to handle Saga", err);

        untouchedSaga.messagesToDispatch.push(
          new DomainEvent(
            {
              name: err.name,
              aggregate: { id: saga.id, name: saga.name, context: saga.context },
              data: { error: err, message: event },
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

  private async publishCommands(saga: Saga): Promise<void> {
    if (!saga.messagesToDispatch.length) return;

    await this.messageBus.publish(saga.messagesToDispatch);

    if (saga.revision > 0) {
      await this.store.clearMessagesToDispatch(saga);
    }
  }

  // private static

  private static getQueue(context: string, eventHandler: SagaEventHandler): string {
    return `queue.saga.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.saga.context}.${eventHandler.saga.name}`;
  }

  private static getRoutingKey(context: string, eventHandler: SagaEventHandler): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
