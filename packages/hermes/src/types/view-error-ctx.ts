import type { ILogger } from "@lindorm/logger";
import type { ClassLike } from "@lindorm/types";
import type { HermesViewEntity } from "../entities/HermesViewEntity.js";
import type { ErrorDispatchOptions } from "./error-dispatch-options.js";

export type ViewErrorCtx<V extends HermesViewEntity> = {
  error: Error;
  entity: V;
  logger: ILogger;
  dispatch(command: ClassLike, options?: ErrorDispatchOptions): void;
};
