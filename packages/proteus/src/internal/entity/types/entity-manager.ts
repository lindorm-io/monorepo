import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { ProteusHookMeta } from "../../../types/proteus-hook-meta.js";

export type GetIncrementFn = (key: string) => Promise<number>;

export type EntityManagerOptions<E extends IEntity> = {
  context?: ProteusHookMeta;
  getNextIncrement?: GetIncrementFn;
  logger?: ILogger;
  driver: string;
  target: Constructor<E>;
};
