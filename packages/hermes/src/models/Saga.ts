import { snakeCase } from "@lindorm/case";
import { ILogger } from "@lindorm/logger";
import { randomString } from "@lindorm/random";
import { ClassLike, Dict } from "@lindorm/types";
import merge from "deepmerge";
import { z } from "zod";
import { SagaDestroyedError } from "../errors";
import { IHermesMessage, ISaga } from "../interfaces";
import { HermesCommand, HermesEvent, HermesTimeout } from "../messages";
import { HermesMessageSchema } from "../schemas";
import {
  HermesMessageOptions,
  SagaData,
  SagaDispatchOptions,
  SagaOptions,
} from "../types";

export class Saga<S extends Dict = Dict> implements ISaga {
  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly _hash: string;
  private readonly _messagesToDispatch: Array<IHermesMessage>;
  private readonly _processedCausationIds: Array<string>;
  private readonly _revision: number;
  private _destroyed: boolean;
  private _state: S;

  private readonly logger: ILogger;

  public constructor(options: SagaOptions<S>) {
    this.logger = options.logger.child(["Saga"]);

    this.id = options.id;
    this.name = snakeCase(options.name);
    this.context = snakeCase(options.context);

    this._destroyed = options.destroyed || false;
    this._hash = options.hash || randomString(16);
    this._messagesToDispatch = options.messagesToDispatch || [];
    this._processedCausationIds = options.processedCausationIds || [];
    this._revision = options.revision || 0;
    this._state = options.state || ({} as S);
  }

  // public properties

  public get destroyed(): boolean {
    return this._destroyed;
  }

  public get hash(): string {
    return this._hash;
  }

  public get messagesToDispatch(): Array<IHermesMessage> {
    return this._messagesToDispatch;
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

  public toJSON(): SagaData {
    return {
      id: this.id,
      name: this.name,
      context: this.context,
      destroyed: this.destroyed,
      hash: this.hash,
      messagesToDispatch: this.messagesToDispatch,
      processedCausationIds: this.processedCausationIds,
      revision: this.revision,
      state: this.state,
    };
  }

  // public context

  public destroy(): void {
    this.logger.debug("Destroy");

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._destroyed = true;
  }

  public dispatch(
    causation: HermesEvent,
    command: ClassLike,
    options: SagaDispatchOptions = {},
  ): void {
    this.logger.debug("Dispatch", { causation, command, options });

    z.object({
      causation: HermesMessageSchema,
      command: z.record(z.any()),
      options: z
        .object({
          aggregate: z
            .object({
              id: z.string().optional(),
              name: z.string().optional(),
              context: z.string().optional(),
            })
            .optional(),
          delay: z.number().optional(),
          mandatory: z.boolean().optional(),
        })
        .optional(),
    }).parse({ causation, command, options });

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    const { ...data } = command;

    this._messagesToDispatch.push(
      new HermesCommand(
        merge<HermesMessageOptions, SagaDispatchOptions>(
          {
            aggregate: causation.aggregate,
            correlationId: causation.correlationId,
            data,
            meta: causation.meta,
            name: snakeCase(command.constructor.name),
          },
          options,
        ),
      ),
    );
  }

  public mergeState(state: Partial<S>): void {
    this.logger.debug("Merge state", { state });

    z.record(z.any()).parse(state);

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._state = merge(this._state, state);
  }

  public setState(state: S): void {
    this.logger.debug("Set state", { state });

    z.record(z.any()).parse(state);

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._state = state;
  }

  public timeout(causation: HermesEvent, name: string, data: Dict, delay: number): void {
    this.logger.debug("Dispatch timeout", { causation, name, data, delay });

    z.object({
      causation: HermesMessageSchema,
      name: z.string(),
      data: z.record(z.any()),
      delay: z.number(),
    }).parse({ causation, name, data, delay });

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._messagesToDispatch.push(
      new HermesTimeout(
        {
          aggregate: {
            id: this.id,
            name: this.name,
            context: this.context,
          },
          name,
          data,
          delay,
          meta: causation.meta,
        },
        causation,
      ),
    );
  }
}
