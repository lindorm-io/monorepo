import { RedisDocument, RedisEntity } from "./redis-document";

export interface RedisRepository<Document extends RedisDocument, Entity extends RedisEntity> {
  create(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  createMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<Entity>>;
  deleteMany(filter: Partial<Document>, callback?: PostChangeCallback<Entity>): Promise<void>;
  destroy(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<void>;
  destroyMany(entities: Array<Entity>, callback?: PostChangeCallback<Entity>): Promise<void>;
  find(filter: Partial<Document>, options?: RedisRepositoryFindOptions): Promise<Entity>;
  findMany(filter: Partial<Document>, options?: RedisRepositoryFindOptions): Promise<Array<Entity>>;
  findOrCreate(filter: Partial<Document>, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  tryFind(filter: Partial<Document>, options?: RedisRepositoryFindOptions): Promise<Entity | null>;
  ttl(entity: Entity): Promise<number>;
  update(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  updateMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<Entity>>;
  upsert(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
}

export interface RedisRepositoryFindOptions {
  scan?: boolean;
}

export type PostChangeCallback<Entity extends RedisEntity> = (entity: Entity) => Promise<void>;

export type RedisRepositoryOptions<Document extends RedisDocument> = {
  entityName: string;
  indexedAttributes: Array<keyof Document>;
  ttlAttribute?: keyof Document;
};
