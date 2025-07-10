import { ILogger } from "@lindorm/logger";
import { ClassLike, Dict } from "@lindorm/types";
import merge from "deepmerge";
import { z } from "zod";
import { SagaDestroyedError } from "../errors";
import {
  IHermesMessage,
  IHermesMessageBus,
  IHermesRegistry,
  ISagaModel,
} from "../interfaces";
import { DispatchMessageSchema, HermesMessageSchema } from "../schemas";
import {
  AggregateIdentifier,
  HermesMessageOptions,
  SagaData,
  SagaDispatchOptions,
  SagaModelOptions,
} from "../types";
import { extractDataTransferObject } from "../utils/private";

export class SagaModel<S extends Dict = Dict> implements ISagaModel {
  private readonly logger: ILogger;

  public readonly id: string;
  public readonly name: string;
  public readonly context: string;

  private readonly commandBus: IHermesMessageBus;
  private readonly registry: IHermesRegistry;
  private readonly timeoutBus: IHermesMessageBus;

  private readonly _messagesToDispatch: Array<IHermesMessage>;
  private readonly _processedCausationIds: Array<string>;
  private readonly _revision: number;
  private _destroyed: boolean;
  private _state: S;

  public constructor(options: SagaModelOptions<S>) {
    this.logger = options.logger.child(["Saga"]);

    this.id = options.id;
    this.name = options.name;
    this.context = options.context;

    this.commandBus = options.commandBus;
    this.registry = options.registry;
    this.timeoutBus = options.timeoutBus;

    this._destroyed = options.destroyed || false;
    this._messagesToDispatch = options.messagesToDispatch || [];
    this._processedCausationIds = options.processedCausationIds || [];
    this._revision = options.revision || 0;
    this._state = options.state || ({} as S);
  }

  // public properties

  public get destroyed(): boolean {
    return this._destroyed;
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
    causation: IHermesMessage,
    message: ClassLike,
    options: SagaDispatchOptions = {},
  ): void {
    this.logger.debug("Dispatch", { causation, message: message, options });

    DispatchMessageSchema.parse({ causation, message, options });

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    const metadata = this.registry.isCommand(message.constructor)
      ? this.registry.getCommand(message.constructor)
      : this.registry.isTimeout(message.constructor)
        ? this.registry.getTimeout(message.constructor)
        : undefined;

    if (!metadata) {
      throw new Error(
        `Cannot dispatch message of type ${message.constructor.name} - not registered`,
      );
    }

    const aggregate: AggregateIdentifier = {
      id: options.id || causation.aggregate.id,
      name: metadata.aggregate.name,
      context: metadata.aggregate.context,
    };

    const { name, data } = extractDataTransferObject(message);
    const { delay, mandatory, meta = {} } = options;

    const opts = merge<HermesMessageOptions, SagaDispatchOptions>(
      {
        aggregate,
        causationId: causation.id,
        correlationId: causation.correlationId,
        data,
        meta: { ...causation.meta, ...meta },
        name,
      },
      { delay, mandatory },
    );

    const msg = this.registry.isCommand(message.constructor)
      ? this.commandBus.create(opts)
      : this.registry.isTimeout(message.constructor)
        ? this.timeoutBus.create(opts)
        : undefined;

    if (!msg) {
      throw new Error(`Cannot dispatch message of type ${message.constructor.name}`);
    }

    this._messagesToDispatch.push(msg);
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

  public timeout(
    causation: IHermesMessage,
    name: string,
    data: Dict,
    delay: number,
  ): void {
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
      this.timeoutBus.create({
        aggregate: {
          id: this.id,
          name: this.name,
          context: this.context,
        },
        causationId: causation.id,
        correlationId: causation.correlationId,
        data,
        delay,
        meta: causation.meta,
        name,
      }),
    );
  }
}
