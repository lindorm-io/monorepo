import { EntityScannerInput, IEntity } from "@lindorm/entity";
import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { CloneRedisSourceOptions, RedisSourceRepositoryOptions } from "../types";
import { IRedisRepository } from "./RedisRepository";

export interface IRedisSource {
  client: Redis;

  clone(options?: CloneRedisSourceOptions): IRedisSource;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  setup(): Promise<void>;

  addEntities(entities: EntityScannerInput): void;
  repository<E extends IEntity>(
    Entity: Constructor<E>,
    options?: RedisSourceRepositoryOptions,
  ): IRedisRepository<E>;
}
