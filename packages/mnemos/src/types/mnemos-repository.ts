import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { IMnemosCache } from "../interfaces";

export type MnemosRepositoryOptions<E extends IEntity = IEntity> = {
  Entity: Constructor<E>;
  cache: IMnemosCache;
  logger: ILogger;
  namespace?: string;
};
