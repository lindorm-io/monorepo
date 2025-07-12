import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";

export type RedisRepositoryOptions<E extends IEntity> = {
  target: Constructor<E>;
  client: Redis;
  logger: ILogger;
  namespace?: string;
};
