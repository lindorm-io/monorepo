import { Logger } from "@lindorm-io/winston";
import { Redis } from "ioredis";

export interface ILindormCache<Interface, Entity> {
  create(entity: Entity, expiresInSeconds?: number): Promise<Entity>;
  createMany(entities: Array<Entity>, expiresInSeconds?: number): Promise<Array<Entity>>;
  destroy(entity: Entity): Promise<void>;
  find(filter: Partial<Interface>, options?: LindormCacheFindOptions): Promise<Entity>;
  findMany(filter: Partial<Interface>, options?: LindormCacheFindOptions): Promise<Array<Entity>>;
  findOrCreate(filter: Partial<Interface>, expiresInSeconds?: number): Promise<Entity>;
  tryFind(filter: Partial<Interface>, options?: LindormCacheFindOptions): Promise<Entity | null>;
  ttl(entity: Entity): Promise<number>;
  update(entity: Entity, expiresInSeconds?: number): Promise<Entity>;
  updateMany(entities: Array<Entity>, expiresInSeconds?: number): Promise<Array<Entity>>;
}

export interface LindormCacheFindOptions {
  scan?: boolean;
}

export interface CacheOptions {
  client: Redis;
  expiresInSeconds?: number;
  logger: Logger;
}

export interface LindormCacheOptions<Interface> extends CacheOptions {
  entityName: string;
  indexedAttributes: Array<keyof Interface>;
}
