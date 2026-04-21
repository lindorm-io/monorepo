import type { ILogger } from "@lindorm/logger";
import type { ClassLike, DeepPartial, Dict } from "@lindorm/types";
import type { AggregateIdentifier } from "./aggregate-identifier.js";
import type { SagaDispatchOptions } from "./dispatch-options.js";

export type SagaEventCtx<E, S extends Dict = Dict> = {
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
