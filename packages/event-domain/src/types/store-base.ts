import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";
import { CreateIndexesOptions, IndexSpecification } from "mongodb";

export interface StoreBaseIndex {
  indexSpecification: IndexSpecification;
  createIndexesOptions: CreateIndexesOptions;
}

export interface StoreBaseOptions {
  collection: string;
  connection: MongoConnection;
  database?: string;
  indices?: Array<StoreBaseIndex>;
  logger: Logger;
}
