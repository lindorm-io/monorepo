import Joi from "joi";
import { AggregateEventHandler } from "../handler";
import { Command, DomainEvent } from "../message";
import { JOI_MESSAGE } from "../constant";
import { Logger } from "@lindorm-io/winston";
import { assertCamelCase, assertSchema, assertSchemaAsync } from "../util";
import { cloneDeep, find, merge, set } from "lodash";
import {
  AggregateData,
  AggregateEventHandlerContext,
  AggregateOptions,
  IAggregate,
} from "../types";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
  IllegalEntityChangeError,
  MessageTypeError,
} from "../error";

export class Aggregate implements IAggregate {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _eventHandlers: Array<AggregateEventHandler>;
  private readonly _events: Array<DomainEvent>;
  private readonly _state: Record<string, any>;

  private _destroyed: boolean;
  private _destroying: boolean;
  private _numberOfLoadedEvents: number;

  private readonly logger: Logger;

  public constructor(options: AggregateOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["Aggregate"]);

    assertCamelCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._destroyed = false;
    this._destroying = false;
    this._eventHandlers = options.eventHandlers || [];
    this._events = [];
    this._numberOfLoadedEvents = 0;
    this._state = {};
  }

  // public properties

  public get destroyed(): boolean {
    return this._destroyed;
  }
  public set destroyed(_) {
    throw new IllegalEntityChangeError();
  }

  public get events(): Array<DomainEvent> {
    return this._events;
  }
  public set events(_) {
    throw new IllegalEntityChangeError();
  }

  public get numberOfLoadedEvents(): number {
    return this._numberOfLoadedEvents;
  }
  public set numberOfLoadedEvents(_) {
    throw new IllegalEntityChangeError();
  }

  public get state(): Record<string, any> {
    return this._state;
  }
  public set state(_) {
    throw new IllegalEntityChangeError();
  }

  // public

  public async apply(causation: Command, name: string, data?: Record<string, any>): Promise<void> {
    this.logger.debug("Apply Command", { causation, name, data });

    await assertSchemaAsync(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          name: Joi.string().required(),
          data: Joi.object().optional(),
        })
        .required()
        .validateAsync({ causation, name, data }),
    );

    await this.handleEvent(
      new DomainEvent(
        {
          aggregate: { id: this.id, name: this.name, context: this.context },
          data: data,
          name: name,
        },
        causation,
      ),
    );
  }

  public async load(event: DomainEvent): Promise<void> {
    this.logger.debug("Load DomainEvent", { event });

    await assertSchemaAsync(
      Joi.object().keys({ event: JOI_MESSAGE.required() }).required().validateAsync({ event }),
    );

    await this.handleEvent(event);

    this._numberOfLoadedEvents += 1;
  }

  public toJSON(): AggregateData {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      destroyed: this.destroyed,
      events: cloneDeep(this.events),
      numberOfLoadedEvents: cloneDeep(this.numberOfLoadedEvents),
      state: cloneDeep(this.state),
    };
  }

  // private

  private async handleEvent(event: DomainEvent): Promise<void> {
    this.logger.debug("Handle DomainEvent initialised", { event });

    try {
      if (!(event instanceof DomainEvent)) {
        throw new MessageTypeError(event, DomainEvent);
      }

      if (this._destroyed) {
        throw new AggregateDestroyedError();
      }

      const destroying = this._destroying;

      const eventHandler: AggregateEventHandler = find(this._eventHandlers, {
        eventName: event.name,
      });

      if (!(eventHandler instanceof AggregateEventHandler)) {
        throw new HandlerNotRegisteredError();
      }

      const context: AggregateEventHandlerContext = {
        event: event,
        state: cloneDeep(this._state),
        logger: this.logger.createChildLogger(["AggregateEventHandler"]),
        destroy: this.destroy.bind(this),
        destroyNext: this.destroyNext.bind(this),
        mergeState: this.mergeState.bind(this),
        setState: this.setState.bind(this),
      };

      await eventHandler.handler(context);

      if (destroying && !this._destroyed) {
        throw new AggregateNotDestroyedError();
      }

      this._events.push(event);

      this.logger.debug("Handle DomainEvent successful", { event });
    } catch (err) {
      this.logger.error("Handle DomainEvent failed", err);

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

  private mergeState(data: Record<string, any>): void {
    this.logger.debug("Merge state", { data });

    assertSchema(Joi.object().required().validate(data));

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    merge(this._state, data);
  }

  private setState(path: string, value: any): void {
    this.logger.debug("Set state", { path, value });

    assertSchema(
      Joi.object()
        .keys({
          path: Joi.string().required(),
          value: Joi.any().required(),
        })
        .required()
        .validate({ path, value }),
    );

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    set(this._state, path, value);
  }
}
