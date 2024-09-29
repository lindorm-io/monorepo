import { ILogger } from "@lindorm/logger";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import {
  CloneRedisSourceOptions,
  CreateRedisEntityFn,
  RedisSourceEntities,
  ValidateRedisEntityFn,
} from "../types";
import { IRedisEntity } from "./RedisEntity";
import { IRedisRepository } from "./RedisRepository";

export type RedisSourceRepositoryOptions<E extends IRedisEntity> = {
  logger?: ILogger;
  create?: CreateRedisEntityFn<E>;
  validate?: ValidateRedisEntityFn<E>;
};

export interface IRedisSource {
  client: Redis;

  addEntities(entities: RedisSourceEntities): void;
  clone(options?: CloneRedisSourceOptions): IRedisSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  repository<E extends IRedisEntity>(
    Entity: Constructor<E>,
    options?: RedisSourceRepositoryOptions<E>,
  ): IRedisRepository<E>;
  setup(): Promise<void>;
}
