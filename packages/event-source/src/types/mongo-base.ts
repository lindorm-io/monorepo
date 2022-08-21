import { CreateIndexesOptions, IndexSpecification } from "mongodb";

export interface MongoIndex {
  indexSpecification: IndexSpecification;
  createIndexesOptions: CreateIndexesOptions;
}

export type Projection<Attributes> = Record<keyof Partial<Attributes>, number> & {
  _id: 0;
};
