import { IEntityBase } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import {
  CreateRedisEntityFn,
  RedisEntityConfig,
  ValidateRedisEntityFn,
} from "./redis-entity";

export type RedisRepositoryOptions<E extends IEntityBase> = {
  Entity: Constructor<E>;
  client: Redis;
  config?: RedisEntityConfig<E>;
  logger: ILogger;
  namespace?: string;
  create?: CreateRedisEntityFn<E>;
  validate?: ValidateRedisEntityFn<E>;
};
