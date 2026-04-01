import type { ILogger } from "@lindorm/logger";
import type { ClassLike, Dict } from "@lindorm/types";

export type AggregateCommandCtx<C = unknown, S extends Dict = Dict> = {
  command: C;
  state: S;
  logger: ILogger;
  meta: Dict;
  apply(event: ClassLike): Promise<void>;
};
