import type { ILogger } from "@lindorm/logger";
import type { DeepPartial, Dict } from "@lindorm/types";

export type AggregateEventCtx<E = unknown, S extends Dict = Dict> = {
  event: E;
  state: S;
  logger: ILogger;
  meta: Dict;
  destroy(): void;
  destroyNext(): void;
  mergeState(data: DeepPartial<S>): void;
  setState(state: S): void;
};
