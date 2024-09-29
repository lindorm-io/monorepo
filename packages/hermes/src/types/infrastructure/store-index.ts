import { Dict } from "@lindorm/types";

import { CreateIndexesOptions, IndexSpecification } from "mongodb";

export type MongoIndex = {
  indexSpecification: IndexSpecification;
  createIndexesOptions: CreateIndexesOptions;
};

export type StoreIndex<F extends Dict = Dict> = {
  fields: Array<Partial<keyof F>>;
  name: string;
  unique: boolean;
};

export type StoreIndexes<F extends Dict = Dict> = Array<StoreIndex<F>>;
