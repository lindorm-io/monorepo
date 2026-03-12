import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../../../interfaces";

export type GetIncrementFn = (key: string) => Promise<number>;

export type EntityManagerOptions<E extends IEntity> = {
  context?: unknown;
  getNextIncrement?: GetIncrementFn;
  logger?: ILogger;
  driver: string;
  target: Constructor<E>;
};
