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
  create(entity: Entity): Promise<Entity>;
  createMany(entities: Array<Entity>): Promise<Array<Entity>>;
  destroy(entity: Entity): Promise<void>;
  destroyMany(filter: Partial<Interface>, options?: DeleteOptions): Promise<void>;
  find(filter: Partial<Interface>, options?: FindOptions<Interface>): Promise<Entity>;
  findMany(filter: Partial<Interface>, options?: FindOptions<Interface>): Promise<Array<Entity>>;
  findOrCreate(filter: Partial<Interface>): Promise<Entity>;
  tryFind(
    filter: Partial<Interface>,
    options?: FindOptions<Interface>,
  ): Promise<Entity | undefined>;
  update(entity: Entity): Promise<Entity>;
  updateMany(entities: Array<Entity>): Promise<Array<Entity>>;
}

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
