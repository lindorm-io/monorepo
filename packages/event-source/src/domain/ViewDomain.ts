import EventEmitter from "events";
import { DomainEvent, ErrorMessage } from "../message";
import { ILogger } from "@lindorm-io/winston";
import { IMessageBus } from "@lindorm-io/amqp";
import { LindormError } from "@lindorm-io/errors";
import { MAX_PROCESSED_CAUSATION_IDS_LENGTH } from "../constant";
import { View } from "../entity";
import { ViewEventHandlerImplementation } from "../handler";
import { assertSnakeCase } from "../util";
import { cloneDeep, find, isArray, isUndefined, some } from "lodash";
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
  IMessage,
  ViewIdentifier,
  IDomainViewStore,
} from "../types";

export class ViewDomain implements IViewDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<ViewEventHandlerImplementation>;
  private readonly logger: ILogger;
  private messageBus: IMessageBus;
  private store: IDomainViewStore;

  public constructor(options: ViewDomainOptions, logger: ILogger) {
    this.logger = logger.createChildLogger(["ViewDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventEmitter = new EventEmitter();
    this.eventHandlers = [];
  }

  public on<TState extends State = State>(
    eventName: string,
    listener: EventEmitterListener<TState>,
  ): void {
    this.eventEmitter.on(eventName, listener);
  }

  public async registerEventHandler(eventHandler: ViewEventHandlerImplementation): Promise<void> {
    this.logger.debug("Registering event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
      view: eventHandler.view,
    });

    if (!(eventHandler instanceof ViewEventHandlerImplementation)) {
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
        version: eventHandler.version,
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
        throw new LindormError("Event handler has already been registered", {
          debug: {
            eventName: eventHandler.eventName,
            version: eventHandler.version,
            aggregate: {
              name: eventHandler.aggregate.name,
              context: eventHandler.aggregate.context,
            },
            view: {
              name: eventHandler.view.name,
              context: eventHandler.view.context,
            },
          },
        });
      }

      assertSnakeCase(context);
      assertSnakeCase(eventHandler.aggregate.name);
      assertSnakeCase(eventHandler.view.context);
      assertSnakeCase(eventHandler.view.name);
      assertSnakeCase(eventHandler.eventName);

      this.eventHandlers.push(
        new ViewEventHandlerImplementation({
          eventName: eventHandler.eventName,
          adapters: eventHandler.adapters,
          aggregate: {
            name: eventHandler.aggregate.name,
            context: context,
          },
          conditions: eventHandler.conditions,
          getViewId: eventHandler.getViewId,
          handler: eventHandler.handler,
          view: eventHandler.view,
        }),
      );

      await this.messageBus.subscribe({
        callback: (message: IMessage) => this.handleEvent(message, eventHandler.view),
        queue: ViewDomain.getQueue(context, eventHandler),
        topic: ViewDomain.getTopic(context, eventHandler),
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

  // private

  private async handleEvent(event: DomainEvent, viewIdentifier: HandlerIdentifier): Promise<void> {
    this.logger.debug("Handling event", { event, viewIdentifier });

    const conditionValidators = [];

    const eventHandler = find(this.eventHandlers, {
      eventName: event.name,
      version: event.version,
      aggregate: {
        name: event.aggregate.name,
        context: event.aggregate.context,
      },
      view: {
        name: viewIdentifier.name,
        context: viewIdentifier.context,
      },
    });

    if (!(eventHandler instanceof ViewEventHandlerImplementation)) {
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

    const identifier: ViewIdentifier = {
      id: eventHandler.getViewId(event),
      name: viewIdentifier.name,
      context: viewIdentifier.context,
    };

    let view = await this.store.load(identifier, eventHandler.adapters);

    this.logger.debug("View loaded", { view: view.toJSON() });

    const exists = await this.store.causationExists(identifier, event);

    this.logger.debug("Causation exists", { exists });

    try {
      if (!exists && !view.processedCausationIds.includes(event.id)) {
        view = await this.handleView(view, event, eventHandler, conditionValidators);
      }

      view = await this.processCausationIds(view, eventHandler);

      this.logger.verbose("Handled event", { event, view: view.toJSON() });
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

  private async handleView(
    view: View,
    event: DomainEvent,
    eventHandler: ViewEventHandlerImplementation,
    conditionValidators: Array<(view: View) => void>,
  ): Promise<View> {
    const json = view.toJSON();

    this.logger.debug("Handling View", { view: json, event });

    for (const validator of conditionValidators) {
      validator(view);
    }

    const context: ViewEventHandlerContext = {
      event: cloneDeep(event.data),
      logger: this.logger.createChildLogger(["ViewEventHandler"]),
      state: cloneDeep(view.state),

      addListItem: view.addListItem.bind(view, event),
      destroy: view.destroy.bind(view),
      removeListItemWhereEqual: view.removeListItemWhereEqual.bind(view, event),
      removeListItemWhereMatch: view.removeListItemWhereMatch.bind(view, event),
      setState: view.setState.bind(view, event),
    };

    await eventHandler.handler(context);

    const saved = await this.store.save(view, event, eventHandler.adapters);

    this.emit(saved);

    this.logger.debug("Saved view at new revision", {
      id: saved.id,
      name: saved.name,
      context: saved.context,
      revision: saved.revision,
    });

    return saved;
  }

  private async processCausationIds(
    view: View,
    eventHandler: ViewEventHandlerImplementation,
  ): Promise<View> {
    if (view.processedCausationIds.length < MAX_PROCESSED_CAUSATION_IDS_LENGTH) {
      return view;
    }

    this.logger.debug("Processing causation ids for view", {
      id: view.id,
      name: view.name,
      context: view.context,
      processedCausationIds: view.processedCausationIds,
    });

    await this.store.processCausationIds(view);
    return await this.store.clearProcessedCausationIds(view, eventHandler.adapters);
  }

  private async rejectEvent(event: DomainEvent, view: View, error: DomainError): Promise<void> {
    try {
      this.logger.debug("Rejecting event", { event, view, error });

      await this.messageBus.publish([
        new ErrorMessage(
          {
            name: error.name,
            aggregate: { id: view.id, name: view.name, context: view.context },
            data: { error, message: event },
            mandatory: false,
            origin: "view_domain",
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

  private static getQueue(context: string, eventHandler: ViewEventHandlerImplementation): string {
    return `queue.view.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.view.context}.${eventHandler.view.name}`;
  }

  private static getTopic(context: string, eventHandler: ViewEventHandlerImplementation): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
