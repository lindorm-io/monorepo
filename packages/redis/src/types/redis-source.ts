import { IEntity } from "@lindorm/entity";
import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { RedisOptions } from "ioredis";
import { CreateRedisEntityFn, ValidateRedisEntityFn } from "./redis-repository";

export type RedisSourceEntity<E extends IEntity = IEntity> = {
  Entity: Constructor<E>;
  create?: CreateRedisEntityFn<E>;
  validate?: ValidateRedisEntityFn<E>;
};

export type RedisSourceEntities = Array<
  Constructor<IEntity> | RedisSourceEntity | string
>;

export type RedisSourceRepositoryOptions<E extends IEntity> = {
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
