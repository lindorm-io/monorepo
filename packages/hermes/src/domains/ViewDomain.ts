import { snakeCase } from "@lindorm/case";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import EventEmitter from "events";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  ViewAlreadyCreatedError,
  ViewDestroyedError,
  ViewNotCreatedError,
} from "../errors";
import { HermesViewEventHandler } from "../handlers";
import {
  IHermesMessageBus,
  IHermesViewEventHandler,
  IHermesViewStore,
  IView,
  IViewDomain,
} from "../interfaces";
import { HermesEvent } from "../messages";
import { View } from "../models";
import {
  HandlerIdentifier,
  ViewDomainOptions,
  ViewEventHandlerAdapter,
  ViewEventHandlerContext,
  ViewIdentifier,
} from "../types";
import { EventEmitterListener, EventEmitterViewData } from "../types/event-emitter";

export class ViewDomain implements IViewDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<IHermesViewEventHandler>;
  private readonly logger: ILogger;
  private errorBus: IHermesMessageBus;
  private eventBus: IHermesMessageBus;
  private store: IHermesViewStore;

  public constructor(options: ViewDomainOptions) {
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.child(["ViewDomain"]);

    this.errorBus = options.errorBus;
    this.eventBus = options.eventBus;
    this.store = options.store;

    this.eventHandlers = [];
  }

  public on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerEventHandler<T extends ClassLike = ClassLike>(
    eventHandler: IHermesViewEventHandler<T>,
  ): Promise<void> {
    this.logger.debug("Registering event handler", {
      adapter: eventHandler.adapter,
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
      view: eventHandler.view,
    });

    if (!(eventHandler instanceof HermesViewEventHandler)) {
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

      this.eventHandlers.push(
        new HermesViewEventHandler<T>({
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

      await this.eventBus.subscribe({
        callback: (message: HermesEvent) => this.handleEvent(message, eventHandler.view),
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

  public async inspect<S extends Dict = Dict>(
    viewIdentifier: ViewIdentifier,
    adapter: ViewEventHandlerAdapter,
  ): Promise<IView<S>> {
    return (await this.store.load(viewIdentifier, adapter)) as IView<S>;
  }

  // private

  private async handleEvent(
    event: HermesEvent,
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

    if (!(eventHandler instanceof HermesViewEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((view: IView) => {
      if (view.destroyed) {
        throw new ViewDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((view: IView) => {
        if (view.revision < 1) {
          throw new ViewNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((view: IView) => {
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

    const data = await this.store.load(viewIdentifier, eventHandler.adapter);

    let view: IView = new View({ ...data, logger: this.logger });

    this.logger.debug("View loaded", { view: view.toJSON() });

    const causations = await this.store.loadCausations(
      viewIdentifier,
      eventHandler.adapter,
    );

    const causationExists =
      causations.includes(event.id) || view.processedCausationIds.includes(event.id);

    this.logger.debug("Causation exists", { causationExists });

    try {
      if (!causationExists) {
        view = await this.handleView(view, event, eventHandler, conditionValidators);
      }

      view = await this.processCausationIds(view, eventHandler);

      this.logger.verbose("Handled event", { event, view: view.toJSON() });

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
        return await this.rejectEvent(event, view, err);
      }

      throw err;
    }
  }

  private async handleView(
    view: IView,
    event: HermesEvent,
    eventHandler: IHermesViewEventHandler,
    conditionValidators: Array<(view: IView) => void>,
  ): Promise<IView> {
    const json = view.toJSON();

    this.logger.debug("Handling View", { view: json, event });

    for (const validator of conditionValidators) {
      validator(view);
    }

    const ctx: ViewEventHandlerContext = {
      event: structuredClone(event.data),
      logger: this.logger.child(["ViewEventHandler"]),
      state: structuredClone(view.state),

      destroy: view.destroy.bind(view, event),
      mergeState: view.mergeState.bind(view, event),
      setState: view.setState.bind(view, event),
    };

    await eventHandler.handler(ctx);

    const data = await this.store.save(view, event, eventHandler.adapter);

    this.logger.debug("Saved view at new revision", {
      id: data.id,
      name: data.name,
      context: data.context,
      revision: data.revision,
    });

    return new View({ ...data, logger: this.logger });
  }

  private async processCausationIds(
    view: IView,
    eventHandler: IHermesViewEventHandler,
  ): Promise<IView> {
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

    const data = await this.store.saveCausations(view, eventHandler.adapter);

    return new View({ ...data, logger: this.logger });
  }

  private async rejectEvent(
    event: HermesEvent,
    view: IView,
    error: DomainError,
  ): Promise<void> {
    try {
      this.logger.debug("Rejecting event", { event, view, error });

      await this.errorBus.publish(
        this.errorBus.create({
          data: {
            error,
            message: event,
            view: { id: view.id, name: view.name, context: view.context },
          },
          aggregate: event.aggregate,
          causationId: event.id,
          correlationId: event.correlationId,
          mandatory: false,
          meta: event.meta,
          name: snakeCase(error.name),
        }),
      );

      this.logger.verbose("Rejected event", { event, view, error });
    } catch (err: any) {
      this.logger.warn("Failed to reject event", err);

      throw err;
    }
  }

  private emit<S extends Dict = Dict>(view: IView<S>): void {
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

  private static getQueue<T extends ClassLike = ClassLike>(
    context: string,
    eventHandler: HermesViewEventHandler<T>,
  ): string {
    return `queue.view.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.view.context}.${eventHandler.view.name}`;
  }

  private static getTopic<T extends ClassLike = ClassLike>(
    context: string,
    eventHandler: HermesViewEventHandler<T>,
  ): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
