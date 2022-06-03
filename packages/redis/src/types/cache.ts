import { ILogger } from "@lindorm-io/winston";
import { RedisConnection } from "../infrastructure";

export interface ICache<Interface, Entity> {
  create(
    entity: Entity,
    expiresInSeconds?: number,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Entity>;
  createMany(
    entities: Array<Entity>,
    expiresInSeconds?: number,
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
  findOrCreate(
    filter: Partial<Interface>,
    expiresInSeconds?: number,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Entity>;
  tryFind(filter: Partial<Interface>, options?: LindormCacheFindOptions): Promise<Entity | null>;
  ttl(entity: Entity): Promise<number>;
  update(
    entity: Entity,
    expiresInSeconds?: number,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Entity>;
  updateMany(
    entities: Array<Entity>,
    expiresInSeconds?: number,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>>;
}

export interface LindormCacheFindOptions {
  scan?: boolean;
}

export type PostChangeCallback<Entity> = (entity: Entity) => Promise<void>;

export interface CacheOptions {
  connection: RedisConnection;
  expiresInSeconds?: number;
  logger: ILogger;
}

export interface LindormCacheOptions<Interface> extends CacheOptions {
  entityName: string;
  indexedAttributes: Array<keyof Interface>;
}
