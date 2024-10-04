import { snakeCase } from "@lindorm/case";
import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import merge from "deepmerge";
import { z } from "zod";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
} from "../errors";
import { InvalidMessageTypeError } from "../errors/InvalidMessageTypeError";
import { HermesAggregateEventHandler } from "../handlers";
import { IAggregate, IHermesAggregateEventHandler, IHermesMessage } from "../interfaces";
import { HermesCommand, HermesEvent } from "../messages";
import { HermesMessageSchema } from "../schemas";
import { AggregateData, AggregateEventHandlerContext, AggregateOptions } from "../types";
import { extractDataTransferObject } from "../utils/private";

export class Aggregate<S extends Dict = Dict> implements IAggregate {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _eventHandlers: Array<IHermesAggregateEventHandler>;
  private readonly _events: Array<IHermesMessage>;

  private _destroyed: boolean;
  private _destroying: boolean;
  private _numberOfLoadedEvents: number;
  private _state: S;

  private readonly logger: ILogger;

  public constructor(options: AggregateOptions) {
    this.logger = options.logger.child(["Aggregate"]);

    this.id = options.id;
    this.name = snakeCase(options.name);
    this.context = snakeCase(options.context);

    this._destroyed = false;
    this._destroying = false;
    this._eventHandlers = options.eventHandlers || [];
    this._events = [];
    this._numberOfLoadedEvents = 0;
    this._state = {} as unknown as S;
  }

  // public properties

  public get destroyed(): boolean {
    return this._destroyed;
  }

  public get events(): Array<IHermesMessage> {
    return this._events;
  }

  public get numberOfLoadedEvents(): number {
    return this._numberOfLoadedEvents;
  }

  public get state(): Record<string, any> {
    return this._state;
  }

  // public

  public async apply(causation: HermesCommand, event: ClassLike): Promise<void> {
    this.logger.debug("Apply Command", { causation, event });

    z.object({
      causation: z.object({ meta: z.record(z.any()) }),
      event: z.record(z.any()),
    }).parse({ causation, event });

    const { name, version, data } = extractDataTransferObject(event);

    await this.handleEvent(
      new HermesEvent(
        {
          aggregate: { id: this.id, name: this.name, context: this.context },
          data,
          name,
          meta: causation.meta,
          version,
        },
        causation,
      ),
    );
  }

  public async load(event: HermesEvent): Promise<void> {
    this.logger.debug("Load HermesEvent", { event });

    HermesMessageSchema.parse(event);

    await this.handleEvent(event);

    this._numberOfLoadedEvents += 1;
  }

  public toJSON(): AggregateData {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      destroyed: this.destroyed,
      events: this.events,
      numberOfLoadedEvents: this.numberOfLoadedEvents,
      state: this.state,
    };
  }

  // private

  private async handleEvent(event: HermesEvent): Promise<void> {
    this.logger.debug("Handle HermesEvent initialised", { event });

    try {
      if (!(event instanceof HermesEvent)) {
        throw new InvalidMessageTypeError(event, HermesEvent);
      }

      if (this._destroyed) {
        throw new AggregateDestroyedError();
      }

      const destroying = this._destroying;

      const eventHandler = this._eventHandlers.find(
        (x) => x.eventName === event.name && x.version === event.version,
      );

      if (!(eventHandler instanceof HermesAggregateEventHandler)) {
        this.logger.error("Event handler not registered", { event });
        throw new HandlerNotRegisteredError();
      }

      const ctx: AggregateEventHandlerContext = {
        event: structuredClone(event.data),
        logger: this.logger.child(["AggregateEventHandler"]),
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

      this._events.push(event);

      this.logger.debug("Handle HermesEvent successful", { event });
    } catch (err: any) {
      this.logger.error("Handle HermesEvent failed", err);

      throw err;
    }
  }

  // private context

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
