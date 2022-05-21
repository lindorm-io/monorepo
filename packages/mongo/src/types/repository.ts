import { CreateIndexesOptions, IndexDirection } from "mongodb";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "../infrastructure";

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
