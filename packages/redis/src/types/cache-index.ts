import { Logger } from "@lindorm-io/winston";
import { RedisConnection } from "../infrastructure";

export interface ICacheBase {
  get(key: string): Promise<Array<string>>;
  add(key: string, value: string, expiresInSeconds?: number): Promise<void>;
  sub(key: string, value: Array<string> | string): Promise<void>;
}

export interface CacheIndexBaseOptions<Interface> {
  connection: RedisConnection;
  indexKey: keyof Interface;
  logger: Logger;
  prefix: string;
}
