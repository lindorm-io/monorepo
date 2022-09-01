import Joi from "joi";
import { AggregateEventHandlerImplementation } from "../handler";
import { Command, DomainEvent } from "../message";
import { ILogger } from "@lindorm-io/winston";
import { JOI_MESSAGE } from "../schema";
import { assertSnakeCase, assertSchema, assertSchemaAsync, extractDtoData } from "../util";
import { cloneDeep, find, merge } from "lodash";
import {
  AggregateData,
  AggregateEventHandlerContext,
  AggregateOptions,
  DtoClass,
  IAggregate,
  IAggregateEventHandler,
  State,
} from "../types";
import {
  AggregateDestroyedError,
  AggregateNotDestroyedError,
  HandlerNotRegisteredError,
  IllegalEntityChangeError,
  MessageTypeError,
} from "../error";

export class Aggregate<TState extends State = State> implements IAggregate {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _eventHandlers: Array<IAggregateEventHandler>;
  private readonly _events: Array<DomainEvent>;

  private _destroyed: boolean;
  private _destroying: boolean;
  private _numberOfLoadedEvents: number;
  private _state: TState;

  private readonly logger: ILogger;

  public constructor(options: AggregateOptions, logger: ILogger) {
    this.logger = logger.createChildLogger(["Aggregate"]);

    assertSnakeCase(options.context);
    assertSnakeCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._destroyed = false;
    this._destroying = false;
    this._eventHandlers = options.eventHandlers || [];
    this._events = [];
    this._numberOfLoadedEvents = 0;
    this._state = {} as unknown as TState;
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

  public async apply(causation: Command, event: DtoClass): Promise<void> {
    this.logger.debug("Apply Command", { causation, event });

    await assertSchemaAsync(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          event: Joi.object().optional(),
        })
        .required()
        .validateAsync({ causation, event }),
    );

    const { name, version, data } = extractDtoData(event);

    await this.handleEvent(
      new DomainEvent(
        {
          aggregate: { id: this.id, name: this.name, context: this.context },
          data,
          name,
          metadata: causation.metadata,
          version,
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

      const eventHandler: AggregateEventHandlerImplementation = find(this._eventHandlers, {
        eventName: event.name,
        version: event.version,
      });

      if (!(eventHandler instanceof AggregateEventHandlerImplementation)) {
        throw new HandlerNotRegisteredError();
      }

      const ctx: AggregateEventHandlerContext = {
        event: cloneDeep(event.data),
        logger: this.logger.createChildLogger(["AggregateEventHandler"]),
        state: cloneDeep(this.state),

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

  private mergeState(data: Partial<TState>): void {
    this.logger.debug("Merge state", { data });

    assertSchema(Joi.object().required().validate(data));

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    merge(this._state, data);
  }

  private setState(state: TState): void {
    this.logger.debug("Set state", { state });

    assertSchema(Joi.object().required().validate(state));

    if (this._destroyed) {
      throw new AggregateDestroyedError();
    }

    this._state = state;
  }
}
