import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import merge from "deepmerge";
import { z } from "zod";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
  InvalidMessageTypeError,
} from "../errors";
import { HermesAggregateEventHandler } from "../handlers";
import {
  IAggregateModel,
  IHermesMessage,
  IHermesMessageBus,
  IHermesRegistry,
} from "../interfaces";
import { HermesEvent } from "../messages";
import { AggregateData, AggregateEventCtx, AggregateModelOptions } from "../types";
import { extractDataTransferObject, recoverEvent } from "../utils/private";

export class AggregateModel<S extends Dict = Dict> implements IAggregateModel {
  private readonly logger: ILogger;

  public readonly id: string;
  public readonly name: string;
  public readonly namespace: string;

  private readonly eventBus: IHermesMessageBus<HermesEvent<Dict>>;
  private readonly registry: IHermesRegistry;

  private readonly _events: Array<HermesEvent<Dict>>;
  private _destroyed: boolean;
  private _destroying: boolean;
  private _numberOfLoadedEvents: number;
  private _state: S;

  public constructor(options: AggregateModelOptions) {
    this.logger = options.logger.child(["Aggregate"]);

    this.id = options.id;
    this.name = options.name;
    this.namespace = options.namespace;

    this.eventBus = options.eventBus;
    this.registry = options.registry;

    this._destroyed = false;
    this._destroying = false;
    this._events = [];
    this._numberOfLoadedEvents = 0;
    this._state = {} as unknown as S;
  }

  // public properties

  public get destroyed(): boolean {
    return this._destroyed;
  }

  public get events(): Array<HermesEvent<Dict>> {
    return this._events;
  }

  public get numberOfLoadedEvents(): number {
    return this._numberOfLoadedEvents;
  }

  public get state(): Dict {
    return this._state;
  }

  // public

  public async apply(causation: IHermesMessage, event: ClassLike): Promise<void> {
    this.logger.debug("Apply Command", { causation, event });

    z.object({
      causation: z.object({ meta: z.record(z.any()) }),
      event: z.record(z.any()),
    }).parse({ causation, event });

    const { name, version, data } = extractDataTransferObject(event);

    await this.handleEvent(
      this.eventBus.create({
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
      }),
    );
  }

  public async load(event: IHermesMessage): Promise<void> {
    this.logger.debug("Load HermesEvent", { event });

    await this.handleEvent(event);

    this._numberOfLoadedEvents += 1;
  }

  public toJSON(): AggregateData {
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

  // private

  private async handleEvent(message: IHermesMessage): Promise<void> {
    this.logger.debug("Handle HermesEvent initialised", { message });

    try {
      if (!(message instanceof HermesEvent)) {
        throw new InvalidMessageTypeError(message, HermesEvent);
      }

      const event = recoverEvent(message);

      if (this._destroyed) {
        throw new AggregateDestroyedError();
      }

      const destroying = this._destroying;

      const eventHandler = this.registry.aggregateEventHandlers.find(
        (x) =>
          x.aggregate.name === message.aggregate.name &&
          x.aggregate.namespace === message.aggregate.namespace &&
          x.event.name === message.name &&
          x.event.version === message.version,
      );

      if (!(eventHandler instanceof HermesAggregateEventHandler)) {
        this.logger.error("Event handler not registered", { event: message });

        throw new HandlerNotRegisteredError();
      }

      const ctx: AggregateEventCtx<typeof event, Dict> = {
        event,
        logger: this.logger.child(["AggregateEventHandler"]),
        meta: message.meta,
        state: structuredClone(this.state),

        destroy: this.destroy.bind(this),
        destroyNext: this.destroyNext.bind(this),
        mergeState: this.mergeState.bind(this),
        setState: this.setState.bind(this),
      };

      await eventHandler.handler(ctx);

      if (destroying && !this._destroyed) {
        throw new AggregateNotDestroyedError();
      }

      this._events.push(message);

      this.logger.debug("Handle HermesEvent successful", { event: message });
    } catch (err: any) {
      this.logger.error("Handle HermesEvent failed", err);

      throw err;
    }
  }

  // private namespace

  private destroy(): void {
    this.logger.debug("Destroy");

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._destroyed = true;
    this._destroying = false;
  }

  private destroyNext(): void {
    this.logger.debug("Destroy Next");

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._destroying = true;
  }

  private mergeState(state: Partial<S>): void {
    this.logger.debug("Merge state", { state });

    z.record(z.any()).parse(state);

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._state = merge(this._state, state);
  }

  private setState(state: S): void {
    this.logger.debug("Set state", { state });

    z.record(z.any()).parse(state);

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._state = state;
  }
}
