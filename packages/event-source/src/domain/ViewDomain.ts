import { IMessageBus } from "@lindorm-io/amqp";
import { snakeCase } from "@lindorm-io/case";
import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import clone from "clone";
import EventEmitter from "events";
import { MAX_PROCESSED_CAUSATION_IDS_LENGTH } from "../constant";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../error";
import { ViewEventHandlerImplementation } from "../handler";
import { DomainEvent, ErrorMessage } from "../message";
import { View } from "../model";
import {
  Data,
  DtoClass,
  EventEmitterListener,
  EventEmitterViewData,
  HandlerIdentifier,
  IDomainViewStore,
  IMessage,
  IViewDomain,
  IViewEventHandler,
  State,
  ViewDomainOptions,
  ViewEventHandlerAdapter,
  ViewEventHandlerContext,
  ViewIdentifier,
} from "../types";
import { assertSnakeCase } from "../util";

export class ViewDomain implements IViewDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<IViewEventHandler>;
  private readonly logger: Logger;
  private messageBus: IMessageBus;
  private store: IDomainViewStore;

  public constructor(options: ViewDomainOptions, logger: Logger) {
    this.eventEmitter = new EventEmitter();
    this.logger = logger.createChildLogger(["ViewDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventHandlers = [];
  }

  public on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerEventHandler<T extends DtoClass = DtoClass>(
    eventHandler: ViewEventHandlerImplementation<T>,
  ): Promise<void> {
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

    const contexts = Array.isArray(eventHandler.aggregate.context)
      ? eventHandler.aggregate.context
      : [eventHandler.aggregate.context];

    for (const context of contexts) {
      const existingHandler = this.eventHandlers.some(
        (x) =>
          x.eventName === eventHandler.eventName &&
          x.version === eventHandler.version &&
          x.aggregate.name === eventHandler.aggregate.name &&
          x.aggregate.context === eventHandler.aggregate.context &&
          x.view.name === eventHandler.view.name &&
          x.view.context === eventHandler.view.context,
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
        new ViewEventHandlerImplementation<T>({
          eventName: eventHandler.eventName,
          adapter: eventHandler.adapter,
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

  public async inspect<TState extends State = State>(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<View<TState>> {
    return (await this.store.load(viewIdentifier, adapter)) as View<TState>;
  }

  // private

  private async handleEvent(
    event: DomainEvent,
    handlerIdentifier: HandlerIdentifier,
  ): Promise<void> {
    this.logger.debug("Handling event", { event, viewIdentifier: handlerIdentifier });

    const conditionValidators = [];

    const eventHandler = this.eventHandlers.find(
      (x) =>
        x.eventName === event.name &&
        x.version === event.version &&
        x.aggregate.name === event.aggregate.name &&
        x.aggregate.context === event.aggregate.context &&
        x.view.name === handlerIdentifier.name &&
        x.view.context === handlerIdentifier.context,
    );

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
            eventHandler.conditions.permanent === undefined ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const viewIdentifier: ViewIdentifier = {
      id: eventHandler.getViewId(event),
      name: handlerIdentifier.name,
      context: handlerIdentifier.context,
    };

    let view = await this.store.load(viewIdentifier, eventHandler.adapter);

    this.logger.debug("View loaded", { view: view.toJSON() });

    const exists = await this.store.causationExists(viewIdentifier, event, eventHandler.adapter);

    this.logger.debug("Causation exists", { exists });

    try {
      if (!exists && !view.processedCausationIds.includes(event.id)) {
        view = await this.handleView(view, event, eventHandler, conditionValidators);
      }

      view = await this.processCausationIds(view, eventHandler);

      this.logger.verbose("Handled event", { event, view: view.toJSON() });
    } catch (err: any) {
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

    const ctx: ViewEventHandlerContext = {
      event: clone(event.data),
      logger: this.logger.createChildLogger(["ViewEventHandler"]),
      state: clone(view.state),

      destroy: view.destroy.bind(view, event),
      mergeState: view.mergeState.bind(view, event),
      setState: view.setState.bind(view, event),
    };

    await eventHandler.handler(ctx);

    const saved = await this.store.save(view, event, eventHandler.adapter);

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

    await this.store.processCausationIds(view, eventHandler.adapter);
    return await this.store.clearProcessedCausationIds(view, eventHandler.adapter);
  }

  private async rejectEvent(event: DomainEvent, view: View, error: DomainError): Promise<void> {
    try {
      this.logger.debug("Rejecting event", { event, view, error });

      await this.messageBus.publish([
        new ErrorMessage(
          {
            name: snakeCase(error.name),
            aggregate: event.aggregate,
            data: {
              error,
              message: event,
              view: { id: view.id, name: view.name, context: view.context },
            },
            metadata: event.metadata,
            mandatory: false,
          },
          event,
        ),
      ]);

      this.logger.verbose("Rejected event", { event, view, error });
    } catch (err: any) {
      this.logger.warn("Failed to reject event", err);

      throw err;
    }
  }

  private emit<TState extends State = State>(view: View<TState>): void {
    const data: EventEmitterViewData<TState> = {
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

  private static getQueue<T extends DtoClass = DtoClass>(
    context: string,
    eventHandler: ViewEventHandlerImplementation<T>,
  ): string {
    return `queue.view.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.view.context}.${eventHandler.view.name}`;
  }

  private static getTopic<T extends DtoClass = DtoClass>(
    context: string,
    eventHandler: ViewEventHandlerImplementation<T>,
  ): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
