import { Logger } from "@lindorm-io/winston";
import { Redis, RedisOptions } from "ioredis";

export interface IRedisConnection {
  client(): Redis;
  connect(): Promise<void>;
  quit(): Promise<void>;
  waitForConnection(): Promise<void>;
}

export interface RedisConnectionOptions extends RedisOptions {
  winston: Logger;
  customClient?: Redis;
}
