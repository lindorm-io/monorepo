import type { ILogger } from "@lindorm/logger";
import type { IProteusRepository } from "@lindorm/proteus";
import type { HermesViewEntity } from "../entities/HermesViewEntity.js";

export type ViewQueryCtx<Q, V extends HermesViewEntity> = {
  query: Q;
  logger: ILogger;
  repository: IProteusRepository<V>;
};
