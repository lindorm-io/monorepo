import { IEntityBase } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { RedisOptions } from "ioredis";
import {
  CreateRedisEntityFn,
  RedisEntityConfig,
  ValidateRedisEntityFn,
} from "./redis-entity";

export type RedisSourceEntity<E extends IEntityBase = IEntityBase> = {
  Entity: Constructor<E>;
  config?: RedisEntityConfig<E>;
  create?: CreateRedisEntityFn<E>;
  validate?: ValidateRedisEntityFn<E>;
};

export type RedisSourceEntities = Array<
  Constructor<IEntityBase> | RedisSourceEntity | string
>;

export type RedisSourceRepositoryOptions<E extends IEntityBase> = {
  config?: RedisEntityConfig<E>;
  logger?: ILogger;
  create?: CreateRedisEntityFn<E>;
  validate?: ValidateRedisEntityFn<E>;
};

export type CloneRedisSourceOptions = {
  logger?: ILogger;
};

export type RedisSourceOptions = {
  config?: RedisOptions;
  entities?: RedisSourceEntities;
  logger: ILogger;
  namespace?: string;
  url: string;
};
