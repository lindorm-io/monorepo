import { RedisDocument } from "./redis-document";

export interface IRedisIndex {
  get(key: string): Promise<Array<string>>;
  add(key: string, value: string, expiresInSeconds?: number): Promise<void>;
  sub(key: string, value: Array<string> | string): Promise<void>;
}

export interface RedisIndexOptions<Document extends RedisDocument> {
  indexKey: keyof Document;
  prefix: string;
}
