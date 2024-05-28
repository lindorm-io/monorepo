import { ILogger } from "@lindorm/logger";
import { Redis } from "ioredis";
import { IRedisEntity, IRedisRepository } from "../interfaces";

export type RedisRepositoryConstructor<E extends IRedisEntity = any> = new (
  redis: Redis,
  logger: ILogger,
) => IRedisRepository<E>;
