import Joi from "joi";
import { DomainEvent } from "../message";
import { ILogger } from "@lindorm-io/winston";
import { IView, ViewOptions, ViewData, State } from "../types";
import { IllegalEntityChangeError, ViewDestroyedError } from "../error";
import { JOI_MESSAGE } from "../schema";
import { LindormError } from "@lindorm-io/errors";
import { assertSnakeCase, assertSchema } from "../util";
import { cloneDeep, find, get, isEqual, isMatch, remove, set, some } from "lodash";
import { isAfter, parseJSON } from "date-fns";
import { randomString } from "@lindorm-io/core";

export class View<TState extends State = State> implements IView<TState> {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _hash: string;
  private readonly _meta: Record<string, any>;
  private readonly _processedCausationIds: Array<string>;
  private readonly _revision: number;
  private readonly _state: TState;
  private _destroyed: boolean;

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
  public set meta(_) {
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
      meta: cloneDeep(this.meta),
      processedCausationIds: cloneDeep(this.processedCausationIds),
      revision: this.revision,
      state: cloneDeep(this.state),
    };
  }

  // public context

  public addListItem(causation: DomainEvent, path: string, value: any): void {
    this.logger.debug("Add list item", { causation, path, value });

    assertSchema(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          path: Joi.string().required(),
          value: Joi.any().required(),
        })
        .required()
        .validate({ causation, path, value }),
    );

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const timestamp = causation.timestamp;
    const meta = get(this._meta, path, []) as Array<any>;
    const list = get(this._state, path, []) as Array<any>;
    const exists = find(list, (item) => isEqual(item, value));

    const hasMoreRecentChange = some(
      meta,
      (item) => isEqual(item.value, value) && isAfter(parseJSON(item.timestamp), timestamp),
    );

    if (hasMoreRecentChange) {
      return;
    }

    remove(meta, (item) => isEqual(item.value, value));

    meta.push({
      removed: false,
      timestamp,
      value,
    });

    if (!exists) {
      list.push(value);
    }

    set(this._state, path, list);
    set(this._meta, path, meta);
  }

  public destroy(): void {
    this.logger.debug("Destroy");

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    this._destroyed = true;
  }

  public getState(): TState {
    return cloneDeep(this._state);
  }

  public removeListItemWhereEqual(causation: DomainEvent, path: string, value: any): void {
    this.logger.debug("Remove list item where equal", { causation, path, value });

    assertSchema(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          path: Joi.string().required(),
          value: Joi.any().required(),
        })
        .required()
        .validate({ causation, path, value }),
    );

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const timestamp = causation.timestamp;
    const meta = get(this._meta, path, []) as Array<any>;
    const list = get(this._state, path, []) as Array<any>;
    const exists = find(list, (item) => isEqual(item, value));

    if (!exists) {
      throw new LindormError("No existing value can be found");
    }

    const hasMoreRecentChange = some(
      meta,
      (item) => isEqual(item.value, value) && isAfter(parseJSON(item.timestamp), timestamp),
    );

    if (hasMoreRecentChange) {
      return;
    }

    remove(meta, (item) => isEqual(item.value, value));
    remove(list, (item) => isEqual(item, value));

    meta.push({
      removed: true,
      timestamp,
      value: exists,
    });

    set(this._state, path, list);
    set(this._meta, path, meta);
  }

  public removeListItemWhereMatch(
    causation: DomainEvent,
    path: string,
    value: Record<string, any>,
  ): void {
    this.logger.debug("Remove list item where match", { causation, path, value });

    assertSchema(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          path: Joi.string().required(),
          value: Joi.any().required(),
        })
        .required()
        .validate({ causation, path, value }),
    );

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const timestamp = causation.timestamp;
    const meta = get(this._meta, path, []) as Array<any>;
    const list = get(this._state, path, []) as Array<any>;
    const exists = find<Record<string, any>>(list, value);

    if (!exists) {
      throw new LindormError("No matching value can be found");
    }

    const hasMoreRecentChange = some(
      meta,
      (item) => isMatch(item.value, value) && isAfter(parseJSON(item.timestamp), timestamp),
    );

    if (hasMoreRecentChange) {
      return;
    }

    remove(meta, (item) => isMatch(item.value, value));
    remove(list, (item) => isMatch(item, value));

    meta.push({
      removed: true,
      timestamp,
      value: exists,
    });

    set(this._state, path, list);
    set(this._meta, path, meta);
  }

  public setState(causation: DomainEvent, path: string, value: any): void {
    this.logger.debug("Set state", { causation, path, value });

    assertSchema(
      Joi.object()
        .keys({
          causation: JOI_MESSAGE.required(),
          path: Joi.string().required(),
          value: Joi.any().required(),
        })
        .required()
        .validate({ causation, path, value }),
    );

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const timestamp = causation.timestamp;
    const meta = get(this.meta, path, { timestamp }) as Record<string, any>;
    const hasMoreRecentChange = isAfter(parseJSON(meta.timestamp), timestamp);

    if (hasMoreRecentChange) {
      return;
    }

    set(this._state, path, value);
    set(this._meta, path, {
      removed: false,
      timestamp,
      value,
    });
  }
}
