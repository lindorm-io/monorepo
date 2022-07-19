import {
  CountDocumentsOptions,
  CreateIndexesOptions,
  DeleteOptions,
  Filter,
  FindOptions,
  IndexDirection,
} from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { MongoConnection } from "../infrastructure";

export interface IRepository<Interface, Entity> {
  count(filter: Partial<Filter<Interface>>, options: CountDocumentsOptions): Promise<number>;
  create(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  createMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>>;
  deleteMany(filter: Partial<Filter<Interface>>, options: DeleteOptions): Promise<void>;
  destroy(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<void>;
  destroyMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<void>>>>;
  find(filter: Partial<Filter<Interface>>, options: FindOptions<Interface>): Promise<Entity>;
  findMany(
    filter: Partial<Filter<Interface>>,
    options: FindOptions<Interface>,
  ): Promise<Array<Entity>>;
  findOrCreate(filter: Partial<Interface>, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  tryFind(
    filter: Partial<Filter<Interface>>,
    options: FindOptions<Interface>,
  ): Promise<Entity | undefined>;
  update(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  updateMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<PromiseSettledResult<Awaited<Entity>>>>;
}

export type PostChangeCallback<Entity> = (entity: Entity) => Promise<void>;

export interface RepositoryOptions {
  connection: MongoConnection;
  database?: string;
  logger: ILogger;
}

export interface LindormRepositoryOptions<Interface> extends RepositoryOptions {
  collection: string;
  database?: string;
  indices: Array<IndexOptions<Interface>>;
}

export interface IndexOptions<Interface> {
  index: {
    [key in keyof Interface]?: IndexDirection;
  };
  options: CreateIndexesOptions;
}
