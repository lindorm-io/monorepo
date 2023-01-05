import { Logger } from "@lindorm-io/core-logger";
import { RedisConnection } from "../connection";

export interface ICache<Interface, Entity> {
  create(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  createMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>>;
  deleteMany(
    filter: Partial<Interface>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<void>>>>;
  destroy(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<void>;
  destroyMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<void>>>>;
  find(filter: Partial<Interface>, options?: LindormCacheFindOptions): Promise<Entity>;
  findMany(filter: Partial<Interface>, options?: LindormCacheFindOptions): Promise<Array<Entity>>;
  findOrCreate(filter: Partial<Interface>, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  tryFind(filter: Partial<Interface>, options?: LindormCacheFindOptions): Promise<Entity | null>;
  ttl(entity: Entity): Promise<number>;
  update(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  updateMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>>;
}

export interface LindormCacheFindOptions {
  scan?: boolean;
}

export type PostChangeCallback<Entity> = (entity: Entity) => Promise<void>;

export interface CacheOptions {
  connection: RedisConnection;
  logger: Logger;
}

export interface LindormCacheOptions<Interface> extends CacheOptions {
  entityName: string;
  indexedAttributes: Array<keyof Interface>;
  ttlAttribute?: keyof Interface;
}
