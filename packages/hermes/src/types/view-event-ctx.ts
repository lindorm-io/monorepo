import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import type { HermesViewEntity } from "../entities/HermesViewEntity.js";

export type ViewEventCtx<E, V extends HermesViewEntity> = {
  event: E;
  entity: V;
  logger: ILogger;
  meta: Dict;
  destroy(): void;
};
