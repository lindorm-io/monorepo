import { MongoDocument, MongoEntity } from "./mongo-document";
import {
  CountDocumentsOptions,
  CreateIndexesOptions,
  DeleteOptions,
  Filter,
  FindOptions,
  IndexDirection,
} from "mongodb";

export interface MongoRepository<Document extends MongoDocument, Entity extends MongoEntity> {
  count(filter: Partial<Filter<Document>>, options: CountDocumentsOptions): Promise<number>;
  create(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  createMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>>;
  deleteMany(filter: Partial<Filter<Document>>, options: DeleteOptions): Promise<void>;
  destroy(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<void>;
  destroyMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<void>>>>;
  find(filter: Partial<Filter<Document>>, options: FindOptions<Document>): Promise<Entity>;
  findMany(
    filter: Partial<Filter<Document>>,
    options: FindOptions<Document>,
  ): Promise<Array<Entity>>;
  findOrCreate(
    filter: Partial<Filter<Document>>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Entity>;
  tryFind(
    filter: Partial<Filter<Document>>,
    options: FindOptions<Document>,
  ): Promise<Entity | undefined>;
  update(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  updateMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>>;
  upsert(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
}

export type PostChangeCallback<Entity extends MongoEntity> = (entity: Entity) => Promise<void>;

export interface MongoRepositoryOptions<Document extends MongoDocument> {
  entityName: string;
  database?: string;
  indices: Array<MongoIndexOptions<Document>>;
}

export interface MongoIndexOptions<Document extends MongoDocument> {
  index: {
    [key in keyof Document]?: IndexDirection;
  };
  options: CreateIndexesOptions;
}
