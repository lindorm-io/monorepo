import { IEntityBase } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import {
  CloneRedisSourceOptions,
  RedisSourceEntities,
  RedisSourceRepositoryOptions,
} from "../types";
import { IRedisRepository } from "./RedisRepository";

export interface IRedisSource {
  client: Redis;

  addEntities(entities: RedisSourceEntities): void;
  clone(options?: CloneRedisSourceOptions): IRedisSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  repository<E extends IEntityBase>(
    Entity: Constructor<E>,
    options?: RedisSourceRepositoryOptions<E>,
  ): IRedisRepository<E>;
  setup(): Promise<void>;
}
