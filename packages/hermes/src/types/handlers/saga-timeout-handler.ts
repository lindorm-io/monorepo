import { ILogger } from "@lindorm/logger";
import { ClassLike, Constructor, DeepPartial, Dict } from "@lindorm/types";
import { AggregateIdentifier, HandlerIdentifier } from "../identifiers";
import { SagaDispatchOptions } from "../models";

export type SagaTimeoutCtx<E extends ClassLike, S extends Dict> = {
  aggregate: AggregateIdentifier;
  logger: ILogger;
  meta: Dict;
  state: S;
  timeout: E;
  destroy(): void;
  dispatch(item: ClassLike, options?: SagaDispatchOptions): void;
  mergeState(data: DeepPartial<S>): void;
  setState(state: S): void;
};

export type SagaTimeoutHandlerOptions<C extends Constructor, S extends Dict> = {
  aggregate: HandlerIdentifier;
  timeout: string;
  key: string;
  saga: HandlerIdentifier;
  handler(ctx: SagaTimeoutCtx<C, S>): Promise<void>;
};
