import type { ILogger } from "@lindorm/logger";
import type { ClassLike, Constructor, Dict } from "@lindorm/types";
import type { AggregateIdentifier, SagaDispatchOptions } from "../../types";
import type { HermesRegistry } from "../registry";
import merge from "deepmerge";
import { z } from "zod/v4";
import { SagaDestroyedError } from "../../errors";

export type SagaPendingMessage = {
  kind: "command" | "timeout";
  data: Record<string, unknown>;
  delay?: number;
};

export type SagaModelOptions<S extends Dict = Dict> = {
  id: string;
  name: string;
  namespace: string;
  destroyed?: boolean;
  messagesToDispatch?: Array<SagaPendingMessage>;
  revision?: number;
  state?: S;
};

export type SagaModelDeps = {
  registry: HermesRegistry;
  logger: ILogger;
};

export class SagaModel<S extends Dict = Dict> {
  private readonly logger: ILogger;
  private readonly registry: HermesRegistry;

  public readonly id: string;
  public readonly name: string;
  public readonly namespace: string;

  private _destroyed: boolean;
  private _messagesToDispatch: Array<SagaPendingMessage>;
  private _revision: number;
  private _state: S;

  public constructor(options: SagaModelOptions<S>, deps: SagaModelDeps) {
    this.logger = deps.logger.child(["SagaModel"]);
    this.registry = deps.registry;

    this.id = options.id;
    this.name = options.name;
    this.namespace = options.namespace;

    this._destroyed = options.destroyed ?? false;
    this._messagesToDispatch = options.messagesToDispatch ?? [];
    this._revision = options.revision ?? 0;
    this._state = options.state ?? ({} as S);
  }

  public get destroyed(): boolean {
    return this._destroyed;
  }

  public get messagesToDispatch(): Array<SagaPendingMessage> {
    return this._messagesToDispatch;
  }

  public get revision(): number {
    return this._revision;
  }

  public get state(): S {
    return this._state;
  }

  public destroy(): void {
    this.logger.debug("Destroy");

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._destroyed = true;
  }

  public dispatch(
    causationId: string,
    correlationId: string | null,
    causationMeta: Dict,
    message: ClassLike,
    options: SagaDispatchOptions = {},
  ): void {
    this.logger.debug("Dispatch", { message, options });

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    const isCommand = this.registry.isCommand(message.constructor);
    const isTimeout = this.registry.isTimeout(message.constructor);

    if (!isCommand && !isTimeout) {
      throw new Error(
        `Cannot dispatch message of type ${message.constructor.name} - not registered as command or timeout`,
      );
    }

    const metadata = isCommand
      ? this.registry.getCommand(message.constructor)
      : this.registry.getTimeout(message.constructor);

    const aggregate = this.resolveAggregateForDispatch(
      message.constructor as Constructor,
      options.id,
    );

    const { ...data } = message;
    const { delay, mandatory, meta: optsMeta = {} } = options;

    const pending: SagaPendingMessage = {
      kind: isCommand ? "command" : "timeout",
      data: {
        aggregate,
        causationId,
        correlationId,
        data,
        meta: { ...causationMeta, ...optsMeta },
        name: metadata.name,
        version: metadata.version,
        ...(mandatory !== undefined ? { mandatory } : {}),
      },
      ...(delay !== undefined ? { delay } : {}),
    };

    this._messagesToDispatch.push(pending);
  }

  public timeout(
    causationId: string,
    correlationId: string | null,
    causationMeta: Dict,
    name: string,
    data: Dict,
    delay: number,
  ): void {
    this.logger.debug("Dispatch timeout", { name, data, delay });

    z.object({
      name: z.string(),
      data: z.record(z.string(), z.any()),
      delay: z.number(),
    }).parse({ name, data, delay });

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    const pending: SagaPendingMessage = {
      kind: "timeout",
      data: {
        aggregate: {
          id: this.id,
          name: this.name,
          namespace: this.namespace,
        },
        causationId,
        correlationId,
        data,
        meta: causationMeta,
        name,
      },
      delay,
    };

    this._messagesToDispatch.push(pending);
  }

  public mergeState(state: Partial<S>): void {
    this.logger.debug("Merge state", { state });

    z.record(z.string(), z.any()).parse(state);

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._state = merge(this._state, state as S) as S;
  }

  public setState(state: S): void {
    this.logger.debug("Set state", { state });

    z.record(z.string(), z.any()).parse(state);

    if (this._destroyed) {
      throw new SagaDestroyedError();
    }

    this._state = state;
  }

  public clearMessages(): void {
    this._messagesToDispatch = [];
  }

  private resolveAggregateForDispatch(
    target: Constructor,
    overrideId?: string,
  ): AggregateIdentifier {
    const commandHandler = this.registry.getCommandHandler(target);
    if (commandHandler) {
      return {
        id: overrideId ?? this.id,
        name: commandHandler.aggregate.name,
        namespace: commandHandler.aggregate.namespace,
      };
    }

    return {
      id: overrideId ?? this.id,
      name: this.name,
      namespace: this.namespace,
    };
  }

  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      namespace: this.namespace,
      destroyed: this.destroyed,
      messagesToDispatch: this.messagesToDispatch,
      revision: this.revision,
      state: this.state,
    };
  }
}
