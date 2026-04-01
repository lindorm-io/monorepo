import type { ILogger } from "@lindorm/logger";
import type { ClassLike } from "@lindorm/types";
import type { ErrorDispatchOptions } from "./error-dispatch-options";

export type AggregateErrorCtx = {
  error: Error;
  logger: ILogger;
  dispatch(command: ClassLike, options?: ErrorDispatchOptions): void;
};
