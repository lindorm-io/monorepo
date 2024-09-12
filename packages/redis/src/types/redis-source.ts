import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { RedisOptions } from "ioredis";
import { IRedisEntity } from "../interfaces";
import { ValidateRedisEntityFn } from "./redis-repository";

export type RedisSourceEntity<E extends IRedisEntity = IRedisEntity> = {
  Entity: Constructor<E>;
  validate?: ValidateRedisEntityFn<E>;
};

export type RedisSourceEntities = Array<
  Constructor<IRedisEntity> | RedisSourceEntity | string
>;

export type RedisSourceOptions = {
  config?: RedisOptions;
  entities: RedisSourceEntities;
  logger: ILogger;
  namespace?: string;
  url: string;
};
