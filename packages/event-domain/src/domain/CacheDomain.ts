import EventEmitter from "events";
import { Cache } from "../entity";
import { CacheEventHandler } from "../handler";
import { DomainEvent, Message } from "../message";
import { LindormError } from "@lindorm-io/errors";
import { Logger } from "@lindorm-io/winston";
import { MessageBus, CacheStore } from "../infrastructure";
import { find, findLast, isArray, isUndefined, some } from "lodash";
import {
  ConcurrencyError,
  DomainError,
  HandlerNotRegisteredError,
  CacheAlreadyCreatedError,
  CacheDestroyedError,
  CacheNotCreatedError,
} from "../error";
import {
  CacheDomainOptions,
  CacheEventHandlerContext,
  EventEmitterData,
  EventEmitterListener,
  HandlerIdentifier,
  ICacheDomain,
  State,
} from "../types";

export class CacheDomain implements ICacheDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<CacheEventHandler>;
  private readonly logger: Logger;
  private messageBus: MessageBus;
  private store: CacheStore;

  public constructor(options: CacheDomainOptions) {
    this.logger = options.logger.createChildLogger(["CacheDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventEmitter = new EventEmitter();
    this.eventHandlers = [];
  }

  public on<S = State>(eventName: string, listener: EventEmitterListener<S>): void {
    this.eventEmitter.on(eventName, listener);
  }

  public async registerEventHandler(eventHandler: CacheEventHandler): Promise<void> {
    this.logger.debug("Register CacheEventHandler initialised", { name: eventHandler.eventName });

    if (!(eventHandler instanceof CacheEventHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: "CacheEventHandler",
          actual: typeof eventHandler,
        },
      });
    }

    const contexts = isArray(eventHandler.aggregate.context)
      ? eventHandler.aggregate.context
      : [eventHandler.aggregate.context];

    for (const context of contexts) {
      const existingHandler = some(
        this.eventHandlers,
        (handler) =>
          handler.eventName === eventHandler.eventName &&
          handler.aggregate.name === eventHandler.aggregate.name &&
          handler.aggregate.context === context &&
          handler.cache.name === eventHandler.cache.name &&
          handler.cache.context === eventHandler.cache.context,
      );

      if (existingHandler) {
        throw new LindormError("Event handler has already been registered");
      }

      this.eventHandlers.push(
        new CacheEventHandler({
          eventName: eventHandler.eventName,
          aggregate: {
            name: eventHandler.aggregate.name,
            context: context,
          },
          cache: eventHandler.cache,
          conditions: eventHandler.conditions,
          getCacheId: eventHandler.getCacheId,
          handler: eventHandler.handler,
        }),
      );

      await this.messageBus.subscribe({
        callback: (message: Message) => this.handleEvent(message, eventHandler.cache),
        queue: CacheDomain.getQueue(context, eventHandler),
        routingKey: CacheDomain.getRoutingKey(context, eventHandler),
      });

      this.logger.verbose("Register CacheEventHandler successful", {
        eventName: eventHandler.eventName,
        aggregate: {
          name: eventHandler.aggregate.name,
          context: context,
        },
        cache: eventHandler.cache,
        conditions: eventHandler.conditions,
      });
    }
  }

  // private

  private async handleEvent(event: DomainEvent, cacheIdentifier: HandlerIdentifier): Promise<void> {
    this.logger.debug("Handling DomainEvent", { event });

    const conditionValidators = [];

    const eventHandler = find(this.eventHandlers, {
      eventName: event.name,
      aggregate: {
        name: event.aggregate.name,
        context: event.aggregate.context,
      },
      cache: {
        name: cacheIdentifier.name,
        context: cacheIdentifier.context,
      },
    });

    if (!(eventHandler instanceof CacheEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    conditionValidators.push((cache: Cache) => {
      if (cache.destroyed) {
        throw new CacheDestroyedError();
      }
    });

    if (eventHandler.conditions?.created === true) {
      conditionValidators.push((cache: Cache) => {
        if (cache.revision < 1) {
          throw new CacheNotCreatedError(eventHandler.conditions.permanent === true);
        }
      });
    }

    if (eventHandler.conditions?.created === false) {
      conditionValidators.push((cache: Cache) => {
        if (cache.revision > 0) {
          throw new CacheAlreadyCreatedError(
            isUndefined(eventHandler.conditions.permanent) ||
              eventHandler.conditions.permanent === true,
          );
        }
      });
    }

    const cache = await this.store.load({
      id: eventHandler.getCacheId(event),
      name: cacheIdentifier.name,
      context: cacheIdentifier.context,
    });

    const lastCausationMatchesEventId = findLast(
      cache.causationList,
      (causationId) => causationId === event.id,
    );

    if (lastCausationMatchesEventId) return;

    try {
      for (const validator of conditionValidators) {
        validator(cache);
      }

      const context: CacheEventHandlerContext = {
        event,
        logger: this.logger.createChildLogger(["CacheEventHandler"]),

        addField: cache.addField.bind(cache, event),
        destroy: cache.destroy.bind(cache),
        getState: cache.getState.bind(cache),
        removeFieldWhereEqual: cache.removeFieldWhereEqual.bind(cache, event),
        removeFieldWhereMatch: cache.removeFieldWhereMatch.bind(cache, event),
        setState: cache.setState.bind(cache, event),
      };

      await eventHandler.handler(context);

      const saved = await this.store.save(cache, event);

      this.emit(saved);

      this.logger.verbose("DomainEvent handled successfully");
    } catch (err) {
      if (err instanceof ConcurrencyError) {
        this.logger.warn("Transient concurrency error while handling event", err);
      } else if (err instanceof DomainError) {
        this.logger.warn("Domain error while handling event", err);
      } else {
        this.logger.error("Failed to handle DomainEvent", err);
      }

      if (err instanceof DomainError && err.permanent) {
        return await this.rejectEvent(event, cache, err);
      }

      throw err;
    }
  }

  private async rejectEvent(event: DomainEvent, cache: Cache, error: DomainError): Promise<void> {
    try {
      this.logger.debug("Reject DomainEvent initialised", { event });

      await this.messageBus.publish([
        new DomainEvent(
          {
            name: error.name,
            aggregate: { id: cache.id, name: cache.name, context: cache.context },
            data: { error, message: event },
            mandatory: false,
          },
          event,
        ),
      ]);

      this.logger.verbose("Reject DomainEvent successful");
    } catch (err) {
      this.logger.warn("Reject DomainEvent failed", err);

      throw err;
    }
  }

  private emit<S>(cache: Cache<S>): void {
    const data: EventEmitterData<S> = {
      id: cache.id,
      name: cache.name,
      context: cache.context,
      revision: cache.revision,
      state: cache.state,
    };

    this.eventEmitter.emit("cache", data);
    this.eventEmitter.emit(`cache.${cache.context}`, data);
    this.eventEmitter.emit(`cache.${cache.context}.${cache.name}`, data);
    this.eventEmitter.emit(`cache.${cache.context}.${cache.name}.${cache.id}`, data);
  }

  // private static

  private static getQueue(context: string, eventHandler: CacheEventHandler): string {
    return `queue.cache.${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}.${eventHandler.cache.context}.${eventHandler.cache.name}`;
  }

  private static getRoutingKey(context: string, eventHandler: CacheEventHandler): string {
    return `${context}.${eventHandler.aggregate.name}.${eventHandler.eventName}`;
  }
}
