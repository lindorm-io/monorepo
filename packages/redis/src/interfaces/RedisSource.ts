import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { ValidateRedisEntityFn } from "../types";
import { IRedisEntity } from "./RedisEntity";
import { IRedisRepository } from "./RedisRepository";

export type RedisSourceRepositoryOptions<E extends IRedisEntity> = {
  logger?: ILogger;
  validate?: ValidateRedisEntityFn<E>;
};

export interface IRedisSource {
  client: Redis;

  clone(logger?: ILogger): IRedisSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  repository<E extends IRedisEntity>(
    Entity: Constructor<E>,
    options?: RedisSourceRepositoryOptions<E>,
  ): IRedisRepository<E>;
  setup(): Promise<void>;
}
