import { snakeCase } from "@lindorm/case";
import { ILogger } from "@lindorm/logger";
import { randomString } from "@lindorm/random";
import { DeepPartial, Dict } from "@lindorm/types";
import merge from "deepmerge";
import { z } from "zod";
import { ViewDestroyedError } from "../errors";
import { IView } from "../interfaces";
import { HermesEvent } from "../messages";
import { ViewData, ViewOptions } from "../types";
import { composeObjectMetadata } from "../utils/private/compose-metadata";

export class View<S extends Dict = Dict> implements IView<S> {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _hash: string;
  private readonly _processedCausationIds: Array<string>;
  private readonly _revision: number;
  private _destroyed: boolean;
  private _meta: Record<string, any>;
  private _state: S;

  private readonly logger: ILogger;

  public constructor(options: ViewOptions<S>) {
    this.logger = options.logger.child(["View"]);

    this.id = options.id;
    this.name = snakeCase(options.name);
    this.context = snakeCase(options.context);

    this._destroyed = options.destroyed || false;
    this._hash = options.hash || randomString(16);
    this._meta = options.meta || {};
    this._processedCausationIds = options.processedCausationIds || [];
    this._revision = options.revision || 0;
    this._state = options.state || ({} as unknown as S);
  }

  // public properties

  public get destroyed(): boolean {
    return this._destroyed;
  }

  public get hash(): string {
    return this._hash;
  }

  public get meta(): Record<string, any> {
    return this._meta;
  }

  public get processedCausationIds(): Array<string> {
    return this._processedCausationIds;
  }

  public get revision(): number {
    return this._revision;
  }

  public get state(): S {
    return this._state;
  }

  // public

  public toJSON(): ViewData<S> {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      destroyed: this.destroyed,
      hash: this.hash,
      meta: this._meta,
      processedCausationIds: this.processedCausationIds,
      revision: this.revision,
      state: this.state,
    };
  }

  // public context

  public destroy(causation: HermesEvent): void {
    this.logger.debug("Destroy", { causation });

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    this._destroyed = true;
  }

  public mergeState(causation: HermesEvent, data: DeepPartial<S>): void {
    this.logger.debug("Merge state", { data });

    z.record(z.any()).parse(data);

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const { state, meta } = composeObjectMetadata<S>(
      this._state,
      merge<any, any>(data, this._state),
      this._meta,
      causation.timestamp,
    );

    this._state = state;
    this._meta = meta;
  }

  public setState(causation: HermesEvent, data: S): void {
    this.logger.debug("Set state", { data });

    z.record(z.any()).parse(data);

    if (this._destroyed) {
      throw new ViewDestroyedError();
    }

    const { state, meta } = composeObjectMetadata<S>(
      this._state,
      data,
      this._meta,
      causation.timestamp,
    );

    this._state = state;
    this._meta = meta;
  }
}
