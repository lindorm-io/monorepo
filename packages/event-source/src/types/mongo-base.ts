import { CreateIndexesOptions, IndexSpecification } from "mongodb";

export interface MongoIndex {
  indexSpecification: IndexSpecification;
  createIndexesOptions: CreateIndexesOptions;
}
