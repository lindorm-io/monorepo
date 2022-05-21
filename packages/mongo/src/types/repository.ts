import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "../infrastructure";
import {
  CountDocumentsOptions,
  CreateIndexesOptions,
  DeleteOptions,
  FindOptions,
  IndexDirection,
} from "mongodb";

export interface ILindormRepository<Interface, Entity> {
  count(filter: Partial<Interface>, options?: CountDocumentsOptions): Promise<number>;
  create(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  createMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<Entity>>;
  destroy(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<void>;
  destroyMany(filter: Partial<Interface>, options?: DeleteOptions): Promise<void>;
  find(filter: Partial<Interface>, options?: FindOptions<Interface>): Promise<Entity>;
  findMany(filter: Partial<Interface>, options?: FindOptions<Interface>): Promise<Array<Entity>>;
  findOrCreate(filter: Partial<Interface>, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  tryFind(
    filter: Partial<Interface>,
    options?: FindOptions<Interface>,
  ): Promise<Entity | undefined>;
  update(entity: Entity, callback?: PostChangeCallback<Entity>): Promise<Entity>;
  updateMany(
    entities: Array<Entity>,
    callback?: PostChangeCallback<Entity>,
  ): Promise<Array<Entity>>;
}

export type PostChangeCallback<Entity> = (entity: Entity) => Promise<void>;

export interface RepositoryOptions {
  connection: MongoConnection;
  logger: Logger;
}

export interface LindormRepositoryOptions<Interface> extends RepositoryOptions {
  collectionName: string;
  indices: Array<IndexOptions<Interface>>;
}

export interface IndexOptions<Interface> {
  index: {
    [key in keyof Interface]?: IndexDirection;
  };
  options: CreateIndexesOptions;
}
