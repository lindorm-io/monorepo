import { MemoryDocument, MemoryEntity } from "./memory-document";

export interface MemoryCache<Document extends MemoryDocument, Entity extends MemoryEntity> {
  create(entity: Entity): Promise<Entity>;
  createMany(entities: Array<Entity>): Promise<Array<Entity>>;
  deleteMany(attributes: Partial<Document>): Promise<void>;
  destroy(entity: Entity): Promise<void>;
  destroyMany(entities: Array<Entity>): Promise<void>;
  find(attributes: Partial<Document>): Promise<Entity>;
  findMany(attributes: Partial<Document>): Promise<Array<Entity>>;
  findOrCreate(attributes: Partial<Document>): Promise<Entity>;
  tryFind(attributes: Partial<Document>): Promise<Entity | undefined>;
  ttl(entity: Entity): Promise<number>;
  update(entity: Entity): Promise<Entity>;
  updateMany(entities: Array<Entity>): Promise<Array<Entity>>;
  upsert(entity: Entity): Promise<Entity>;
}

export interface MemoryCacheOptions<Document extends MemoryDocument> {
  entityName: string;
  ttlAttribute?: keyof Document;
}
