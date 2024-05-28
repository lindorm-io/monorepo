import { Constructor } from "@lindorm/types";
import { Redis } from "ioredis";
import { IRedisEntity } from "./RedisEntity";
import { IRedisRepository } from "./RedisRepository";

export type SourceRepositoryOptions = {
  useCache?: boolean;
};

export interface IRedisSource {
  redis: Redis;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  repository<T extends IRedisEntity>(
    Entity: Constructor<T>,
    options?: SourceRepositoryOptions,
  ): IRedisRepository<T>;
}
