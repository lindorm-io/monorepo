import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { CreateIndexesOptions, IndexSpecification } from "mongodb";

export interface MongoIndex {
  indexSpecification: IndexSpecification;
  createIndexesOptions: CreateIndexesOptions;
}

export interface MongoBaseOptions {
  collection: string;
  connection: MongoConnection;
  database?: string;
  indices?: Array<MongoIndex>;
  logger: Logger;
}
