import type { ILogger } from "@lindorm/logger";
import type { ClassLike, Dict } from "@lindorm/types";
import merge from "deepmerge";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
} from "../../errors/index.js";
import type { AggregateEventCtx } from "../../types/index.js";
import type { HermesRegistry } from "../registry/index.js";
import type { RegisteredAggregate, HandlerRegistration } from "../registry/index.js";
import { HermesEventMessage } from "../messages/index.js";
import { applyUpcasters, extractDto } from "../utils/index.js";

export type AggregateModelOptions = {
  id: string;
  name: string;
  namespace: string;
  registry: HermesRegistry;
  logger: ILogger;
};

export type AggregateModelData = {
  id: string;
  name: string;
  namespace: string;
  destroyed: boolean;
  events: Array<HermesEventMessage>;
  numberOfLoadedEvents: number;
  state: Dict;
};

export class AggregateModel<S extends Dict = Dict> {
  private readonly logger: ILogger;
  private readonly registry: HermesRegistry;

  public readonly id: string;
  public readonly name: string;
  public readonly namespace: string;

  private readonly _events: Array<HermesEventMessage>;
  private _destroyed: boolean;
  private _destroying: boolean;
  private _numberOfLoadedEvents: number;
  private _state: S;

  public constructor(options: AggregateModelOptions) {
    this.logger = options.logger.child(["AggregateModel"]);
    this.registry = options.registry;

    this.id = options.id;
    this.name = options.name;
    this.namespace = options.namespace;

    this._destroyed = false;
    this._destroying = false;
    this._events = [];
    this._numberOfLoadedEvents = 0;
    this._state = {} as S;
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }

  public get events(): Array<HermesEventMessage> {
    return this._events;
  }

  public get numberOfLoadedEvents(): number {
    return this._numberOfLoadedEvents;
  }

  public get state(): S {
    return this._state;
  }

  public async apply(
    causation:
      | HermesEventMessage
      | { id: string; correlationId: string | null; meta: Dict },
    event: ClassLike,
  ): Promise<void> {
    this.logger.debug("Applying event from command", { event });

    const { name, version, data } = extractDto(event);

    const eventMessage: HermesEventMessage = Object.assign(new HermesEventMessage(), {
      aggregate: {
        id: this.id,
        name: this.name,
        namespace: this.namespace,
      },
      causationId: causation.id,
      correlationId: causation.correlationId,
      data,
      meta: causation.meta,
      name,
      version,
      timestamp: new Date(),
    });

    await this.handleEvent(eventMessage);
  }

  public async load(event: HermesEventMessage): Promise<void> {
    this.logger.debug("Loading event for replay", { event: event.name });

    await this.handleEvent(event);

    this._numberOfLoadedEvents += 1;
  }

  public toJSON(): AggregateModelData {
    return {
      id: this.id,
      name: this.name,
      namespace: this.namespace,
      destroyed: this.destroyed,
      events: this.events,
      numberOfLoadedEvents: this.numberOfLoadedEvents,
      state: this.state,
    };
  }

  private async handleEvent(message: HermesEventMessage): Promise<void> {
    this.logger.debug("Handling event", { name: message.name, version: message.version });

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    const destroying = this._destroying;

    const aggregate = this.resolveAggregate();

    // Try exact match first (most common path)
    let eventHandler = this.findEventHandler(aggregate, message);
    let eventData = message.data;
    let eventVersion = message.version;

    if (!eventHandler) {
      // No exact match -- attempt upcasting by finding a handler for the same event name
      const handlerByName = this.findEventHandlerByName(aggregate, message.name);

      if (!handlerByName) {
        this.logger.error("Event handler not registered", {
          aggregate: this.name,
          event: message.name,
          version: message.version,
        });
        throw new HandlerNotRegisteredError();
      }

      const handlerDto = this.registry.getEvent(handlerByName.trigger);

      // Only upcast when stored event is older than the handler's version.
      // If the event version exceeds the handler version, the handler is outdated.
      if (message.version > handlerDto.version) {
        this.logger.error("Event version exceeds handler version", {
          aggregate: this.name,
          event: message.name,
          eventVersion: message.version,
          handlerVersion: handlerDto.version,
        });
        throw new HandlerNotRegisteredError();
      }

      this.logger.debug("Upcasting event", {
        event: message.name,
        from: message.version,
        to: handlerDto.version,
      });

      const chain = this.registry.getUpcasterChain(
        message.name,
        message.version,
        handlerDto.version,
      );

      eventData = applyUpcasters(aggregate, chain, message.data);
      eventVersion = handlerDto.version;
      eventHandler = handlerByName;
    }

    const event = this.recoverEventDtoFromData(message.name, eventVersion, eventData);

    const ctx: AggregateEventCtx<typeof event, Dict> = {
      event,
      logger: this.logger.child(["AggregateEventHandler"]),
      meta: message.meta,
      state: structuredClone(this._state as Dict),
      destroy: this.destroy.bind(this),
      destroyNext: this.destroyNext.bind(this),
      mergeState: this.mergeState.bind(this),
      setState: this.setState.bind(this),
    };

    const handler = this.resolveHandlerFunction(aggregate, eventHandler);
    await handler(ctx);

    if (destroying && !this._destroyed) {
      throw new AggregateNotDestroyedError();
    }

    this._events.push(message);
  }

  private resolveAggregate(): RegisteredAggregate {
    return this.registry.getAggregate(this.namespace, this.name);
  }

  private findEventHandler(
    aggregate: RegisteredAggregate,
    message: HermesEventMessage,
  ): HandlerRegistration | undefined {
    return aggregate.eventHandlers.find((h) => {
      const dto = this.registry.getEvent(h.trigger);
      return dto.name === message.name && dto.version === message.version;
    });
  }

  private findEventHandlerByName(
    aggregate: RegisteredAggregate,
    eventName: string,
  ): HandlerRegistration | undefined {
    return aggregate.eventHandlers.find((h) => {
      const dto = this.registry.getEvent(h.trigger);
      return dto.name === eventName;
    });
  }

  private recoverEventDtoFromData(name: string, version: number, data: Dict): ClassLike {
    const metadata = this.registry.getEventByName(name, version);
    const dto = new metadata.target();

    for (const [key, value] of Object.entries(data)) {
      dto[key] = value;
    }

    return dto;
  }

  private resolveHandlerFunction(
    aggregate: RegisteredAggregate,
    handler: HandlerRegistration,
  ): (ctx: AggregateEventCtx<unknown, Dict>) => Promise<void> {
    const instance = new aggregate.target();
    const method = (instance as Record<string, unknown>)[handler.methodName];

    if (typeof method !== "function") {
      throw new HandlerNotRegisteredError();
    }

    return method.bind(instance);
  }

  private destroy(): void {
    this.logger.debug("Destroying aggregate");

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._destroyed = true;
    this._destroying = false;
  }

  private destroyNext(): void {
    this.logger.debug("Marking aggregate for destruction on next event");

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._destroying = true;
  }

  private mergeState(state: Partial<S>): void {
    this.logger.debug("Merging state", { keys: Object.keys(state) });

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._state = merge(this._state, state as S) as S;
  }

  private setState(state: S): void {
    this.logger.debug("Setting state");

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._state = state;
  }
}
