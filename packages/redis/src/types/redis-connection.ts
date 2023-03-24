import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { Redis, RedisOptions } from "ioredis";

export interface IRedisConnection extends IConnectionBase<Redis> {
  namespace: string;
}

export interface ExtendedRedisOptions extends RedisOptions {
  custom?: Redis;
  namespace?: string;
}

export type RedisConnectionOptions = ConnectionBaseOptions<RedisOptions> & ExtendedRedisOptions;
