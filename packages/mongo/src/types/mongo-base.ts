import type { ILogger } from "@lindorm/logger";
import type { CreateIndexesOptions, IndexSpecification, MongoClient } from "mongodb";

export type MongoBaseIndex = {
  index: IndexSpecification;
  options: CreateIndexesOptions;
};

export type MongoBaseOptions = {
  client: MongoClient;
  collection: string;
  database: string;
  indexes: Array<MongoBaseIndex>;
  logger: ILogger;
};
