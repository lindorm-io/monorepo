import Joi from "joi";
import clone from "clone";
import merge from "merge";
import { DomainEvent } from "../message";
import { IView, ViewOptions, ViewData, State } from "../types";
import { IllegalEntityChangeError, ViewDestroyedError } from "../error";
import { Logger } from "@lindorm-io/core-logger";
import { assertSnakeCase, assertSchema, composeObjectMetadata } from "../util";
import { randomString } from "@lindorm-io/random";

export class View<TState extends State = State> implements IView<TState> {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _hash: string;
  private readonly _processedCausationIds: Array<string>;
  private readonly _revision: number;
  private _destroyed: boolean;
  private _meta: Record<string, any>;
  private _state: TState;

  private readonly logger: Logger;

  public constructor(options: ViewOptions<TState>, logger: Logger) {
    this.logger = logger.createChildLogger(["View"]);

    assertSnakeCase(options.context);
    assertSnakeCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._destroyed = options.destroyed || false;
    this._hash = options.hash || randomString(16);
    this._meta = options.meta || {};
    this._processedCausationIds = options.processedCausationIds || [];
    this._revision = options.revision || 0;
    this._state = options.state || ({} as unknown as TState);
  }

  // public properties

  public get destroyed(): boolean {
    return this._destroyed;
  }
  public set destroyed(_) {
    throw new IllegalEntityChangeError();
  }

  public get hash(): string {
    return this._hash;
  }
  public set hash(_) {
    throw new IllegalEntityChangeError();
  }

  public get meta(): Record<string, any> {
    return this._meta;
  }
  public set meta(_: Record<string, any>) {
    throw new IllegalEntityChangeError();
  }

  public get processedCausationIds(): Array<string> {
    return this._processedCausationIds;
  }
  public set processedCausationIds(_) {
    throw new IllegalEntityChangeError();
  }

  public get revision(): number {
    return this._revision;
  }
  public set revision(_) {
    throw new IllegalEntityChangeError();
  }

  public get state(): TState {
    return this._state;
  }
  public set state(_: TState) {
    throw new IllegalEntityChangeError();
  }

  // public

  public toJSON(): ViewData<TState> {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      destroyed: this.destroyed,
      hash: this.hash,
      meta: this._meta,
      processedCausationIds: clone(this.processedCausationIds),
      revision: this.revision,
      state: clone(this.state),
    };
  }

  // public context

  public destroy(causation: DomainEvent): void {
    this.logger.debug("Destroy", { causation });

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    this._destroyed = true;
  }

  public mergeState(causation: DomainEvent, data: Partial<TState>): void {
    this.logger.debug("Merge state", { data });

    assertSchema(Joi.object().required().validate(data));

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const { state, meta } = composeObjectMetadata<TState>(
      this._state,
      merge(data, clone(this._state)),
      this._meta,
      causation.timestamp,
    );

    this._state = state;
    this._meta = meta;
  }

  public setState(causation: DomainEvent, data: TState): void {
    this.logger.debug("Set state", { data });

    assertSchema(Joi.object().required().validate(data));

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const { state, meta } = composeObjectMetadata<TState>(
      this._state,
      data,
      this._meta,
      causation.timestamp,
    );

    this._state = state;
    this._meta = meta;
  }
}
