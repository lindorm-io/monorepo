import { ConnectionBaseOptions, IConnectionBase } from "@lindorm-io/core-connection";
import { Redis, RedisOptions } from "ioredis";

export type IRedisConnection = IConnectionBase<Redis>;

export type RedisConnectionOptions = ConnectionBaseOptions<RedisOptions> & RedisOptions;
