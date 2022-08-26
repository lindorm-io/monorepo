import Joi from "joi";
import { ILogger } from "@lindorm-io/winston";
import { IView, ViewOptions, ViewData, State } from "../types";
import { IllegalEntityChangeError, ViewDestroyedError, ViewNotUpdatedError } from "../error";
import { assertSnakeCase, assertSchema } from "../util";
import { cloneDeep, merge } from "lodash";
import { randomString } from "@lindorm-io/core";
import { DomainEvent } from "../message";
import { isAfter } from "date-fns";

export class View<TState extends State = State> implements IView<TState> {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _hash: string;
  private readonly _processedCausationIds: Array<string>;
  private readonly _revision: number;
  private _destroyed: boolean;
  private _modified: Date | null;
  private _state: TState;

  private readonly logger: ILogger;

  public constructor(options: ViewOptions<TState>, logger: ILogger) {
    this.logger = logger.createChildLogger(["View"]);

    assertSnakeCase(options.context);
    assertSnakeCase(options.name);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this._destroyed = options.destroyed || false;
    this._hash = options.hash || randomString(16);
    this._modified = options.modified || null;
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

  public get modified(): Date {
    return this._modified;
  }
  public set modified(_: Date) {
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
      modified: this._modified,
      processedCausationIds: cloneDeep(this.processedCausationIds),
      revision: this.revision,
      state: cloneDeep(this.state),
    };
  }

  // public context

  public destroy(causation: DomainEvent): void {
    this.logger.debug("Destroy");

    if (this.modified && isAfter(this.modified, causation.timestamp)) {
      throw new ViewNotUpdatedError("View has already been modified");
    }

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    this._destroyed = true;
    this._modified = causation.timestamp;
  }

  public mergeState(causation: DomainEvent, data: Partial<TState>): void {
    this.logger.debug("Merge state", { data });

    if (this.modified && isAfter(this.modified, causation.timestamp)) {
      throw new ViewNotUpdatedError("View has already been modified");
    }

    assertSchema(Joi.object().required().validate(data));

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    merge(this._state, data);
    this._modified = causation.timestamp;
  }

  public setState(causation: DomainEvent, state: TState): void {
    this.logger.debug("Set state", { state });

    if (this.modified && isAfter(this.modified, causation.timestamp)) {
      throw new ViewNotUpdatedError("View has already been modified");
    }

    assertSchema(Joi.object().required().validate(state));

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    this._state = state;
    this._modified = causation.timestamp;
  }
}
