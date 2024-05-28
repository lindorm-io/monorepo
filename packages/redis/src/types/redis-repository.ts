import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { IRedisEntity } from "../interfaces";

export type RedisRepositoryOptions<E extends IRedisEntity> = {
  Entity: Constructor<E>;
  logger: ILogger;
  namespace?: string;
  redis: Redis;
  useCache?: boolean;
};
