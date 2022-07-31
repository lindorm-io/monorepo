import { CreateIndexesOptions, IndexSpecification } from "mongodb";
import { IMongoConnection } from "@lindorm-io/mongo";

export interface MongoIndex {
  indexSpecification: IndexSpecification;
  createIndexesOptions: CreateIndexesOptions;
}

export interface MongoBaseOptions {
  collection: string;
  connection: IMongoConnection;
  indices?: Array<MongoIndex>;
}
