import type { ILogger } from "@lindorm/logger";
import type { ClassLike, DeepPartial, Dict } from "@lindorm/types";
import type { AggregateIdentifier } from "./aggregate-identifier";
import type { SagaDispatchOptions } from "./dispatch-options";

export type SagaTimeoutCtx<E, S extends Dict = Dict> = {
  event: E;
  state: S;
  aggregate: AggregateIdentifier;
  logger: ILogger;
  meta: Dict;
  destroy(): void;
  mergeState(data: DeepPartial<S>): void;
  setState(state: S): void;
  dispatch(command: ClassLike, options?: SagaDispatchOptions): void;
  timeout(name: string, data: Dict, delay: number): void;
};
