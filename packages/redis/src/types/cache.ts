import { Logger } from "@lindorm-io/winston";
import { RedisConnection } from "../infrastructure";

export interface LindormCacheFindOptions {
  scan?: boolean;
}

export type PostChangeCallback<Entity> = (entity: Entity) => Promise<void>;

export interface CacheOptions {
  connection: RedisConnection;
  expiresInSeconds?: number;
  logger: Logger;
}

export interface LindormCacheOptions<Interface> extends CacheOptions {
  entityName: string;
  indexedAttributes: Array<keyof Interface>;
}
