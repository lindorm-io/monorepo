import { ILogger } from "@lindorm/logger";
import { CreateIndexesOptions, Document, IndexSpecification, MongoClient } from "mongodb";
import { MongoIndexOptions } from "./mongo-index";

export type MongoBaseIndex = {
  index: IndexSpecification;
  options: CreateIndexesOptions;
};

export type MongoBaseOptions<D extends Document> = {
  client: MongoClient;
  collectionName: string;
  databaseName: string;
  indexes: Array<MongoIndexOptions<D>>;
  logger: ILogger;
};
