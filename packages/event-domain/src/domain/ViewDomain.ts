import EventEmitter from "events";
import { DomainEvent, Message } from "../message";
import { Filter, FindOptions } from "mongodb";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { MessageBus, ViewStore } from "../infrastructure";
import { View } from "../entity";
import { ViewEventHandler } from "../handler";
import { assertSnakeCase } from "../util";
import { find, findLast, isArray, isUndefined, remove, some } from "lodash";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../error";
import {
  EventEmitterListener,
  EventEmitterData,
  HandlerIdentifier,
  IViewDomain,
  State,
  ViewDomainOptions,
  ViewEventHandlerContext,
  ViewStoreAttributes,
  ViewStoreQueryOptions,
} from "../types";

export class ViewDomain implements IViewDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<ViewEventHandler>;
  private readonly logger: Logger;
  private messageBus: MessageBus;
  private store: ViewStore;

  public constructor(options: ViewDomainOptions) {
    this.logger = options.logger.createChildLogger(["ViewDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventEmitter = new EventEmitter();
    this.eventHandlers = [];
  }

  public on<S extends State = State>(eventName: string, listener: EventEmitterListener<S>): void {
    this.eventEmitter.on(eventName, listener);
  }

  public async query<S extends State = State>(
    queryOptions: ViewStoreQueryOptions,
    filter: Filter<ViewStoreAttributes>,
    findOptions?: FindOptions,
  ): Promise<Array<ViewStoreAttributes<S>>> {
    return this.store.query<S>(queryOptions, filter, findOptions);
  }

  public async registerEventHandler(eventHandler: ViewEventHandler): Promise<void> {
    this.logger.debug("Registering event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
      view: eventHandler.view,
    });

    if (!(eventHandler instanceof ViewEventHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "ViewEventHandler",
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
        view: {
          name: eventHandler.view.name,
          context: eventHandler.view.context,
        },
      });

      if (existingHandler) {
        throw new LindormError("Event handler has already been registered");
      }

      assertSnakeCase(context);
      assertSnakeCase(eventHandler.aggregate.name);
      assertSnakeCase(eventHandler.view.context);
      assertSnakeCase(eventHandler.view.name);
      assertSnakeCase(eventHandler.eventName);

      this.eventHandlers.push(
        new ViewEventHandler({
          eventName: eventHandler.eventName,
          aggregate: {
            name: eventHandler.aggregate.name,
            context: context,
          },
          conditions: eventHandler.conditions,
          documentOptions: eventHandler.documentOptions,
          getViewId: eventHandler.getViewId,
          handler: eventHandler.handler,
          view: eventHandler.view,
        }),
      );

      await this.messageBus.subscribe({
        callback: (message: Message) => this.handleEvent(message, eventHandler.view),
        queue: ViewDomain.getQueue(context, eventHandler),
        routingKey: ViewDomain.getRoutingKey(context, eventHandler),
      });

      this.logger.verbose("Event handler registered", {
        eventName: eventHandler.eventName,
        aggregate: {
          name: eventHandler.aggregate.name,
          context: context,
        },
        view: eventHandler.view,
      });
    }
  }

  public async removeEventHandler(eventHandler: ViewEventHandler): Promise<void> {
    this.logger.debug("Removing event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
      view: eventHandler.view,
    });

    if (!(eventHandler instanceof ViewEventHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "ViewEventHandler",
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
        view: {
          name: eventHandler.view.name,
          context: eventHandler.view.context,
        },
      });

      await this.messageBus.unsubscribe({
        queue: ViewDomain.getQueue(context, eventHandler),
        routingKey: ViewDomain.getRoutingKey(context, eventHandler),
      });

      this.logger.verbose("Event handler removed", {
        eventName: eventHandler.eventName,
        aggregate: {
          name: eventHandler.aggregate.name,
          context: context,
        },
        view: eventHandler.view,
      });
    }
  }

  public async removeAllEventHandlers(): Promise<void> {
    for (const handler of this.eventHandlers) {
      await this.removeEventHandler(handler);
    }
  }

  public async collections(): Promise<Array<string>> {
    return this.store.collections();
  }

  // private

  private async handleEvent(event: DomainEvent, viewIdentifier: HandlerIdentifier): Promise<void> {
    this.logger.debug("Handling event", { event, viewIdentifier });

    const conditionValidators = [];

    const eventHandler = find(this.eventHandlers, {
      eventName: event.name,
      aggregate: {
        name: event.aggregate.name,
        context: event.aggregate.context,
      },
      view: {
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      },
    });

    if (!(eventHandler instanceof ViewEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((view: View) => {
      if (view.destroyed) {
        throw new ViewDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((view: View) => {
        if (view.revision < 1) {
          throw new ViewNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((view: View) => {
        if (view.revision > 0) {
          throw new ViewAlreadyCreatedError(
            isUndefined(eventHandler.conditions.permanent) ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const view = await this.store.load(
      {
        id: eventHandler.getViewId(event),
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      },
      eventHandler.documentOptions,
    );

    const lastCausationMatchesEventId = findLast(
      view.causationList,
      (causationId) => causationId === event.id,
    );

    if (lastCausationMatchesEventId) return;

    try {
      for (const validator of conditionValidators) {
        validator(view);
      }

      const context: ViewEventHandlerContext = {
        event,
        logger: this.logger.createChildLogger(["ViewEventHandler"]),

        addField: view.addField.bind(view, event),
        destroy: view.destroy.bind(view),
        getState: view.getState.bind(view),
        removeFieldWhereEqual: view.removeFieldWhereEqual.bind(view, event),
        removeFieldWhereMatch: view.removeFieldWhereMatch.bind(view, event),
        setState: view.setState.bind(view, event),
      };

      await eventHandler.handler(context);

      const saved = await this.store.save(view, event, eventHandler.documentOptions);

      this.emit(saved);

      this.logger.verbose("Handled event", { event, viewIdentifier });
    } catch (err) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling event", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling event", err);
      } else {
        this.logger.error("Failed to handle event", err);
      }

      if (err instanceof DomainError && err.permanent) {
        return await this.rejectEvent(event, view, err);
      }

      throw err;
    }
  }

  private async rejectEvent(event: DomainEvent, view: View, error: DomainError): Promise<void> {
    try {
      this.logger.debug("Rejecting event", { event, view, error });

      await this.messageBus.publish([
        new DomainEvent(
          {
            name: error.name,
            aggregate: { id: view.id, name: view.name, context: view.context },
            data: { error, message: event },
            mandatory: false,
          },
          event,
        ),
      ]);

      this.logger.verbose("Rejected event", { event, view, error });
    } catch (err) {
      this.logger.warn("Failed to reject event", err);

      throw err;
    }
  }

  private emit<S>(view: View<S>): void {
    const data: EventEmitterData<S> = {
      id: view.id,
      name: view.name,
      context: view.context,
      revision: view.revision,
      state: view.state,
    };

    this.eventEmitter.emit("view", data);
    this.eventEmitter.emit(`view.${view.context}`, data);
    this.eventEmitter.emit(`view.${view.context}.${view.name}`, data);
    this.eventEmitter.emit(`view.${view.context}.${view.name}.${view.id}`, data);
  }

  // private static

  private static getQueue(context: string, eventHandler: ViewEventHandler): string {
    return `queue.view.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.view.context}.${eventHandler.view.name}`;
  }

  private static getRoutingKey(context: string, eventHandler: ViewEventHandler): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
