import { MongoIndex } from "../types";

export const SAGA_COLLECTION = "saga_store";
export const SAGA_COLLECTION_INDICES: Array<MongoIndex> = [
  {
    indexSpecification: {
      id: 1,
      name: 1,
      context: 1,
    },
    createIndexesOptions: {
      name: "unique_path",
      unique: true,
    },
  },
  {
    indexSpecification: {
      id: 1,
      name: 1,
      context: 1,
      hash: 1,
      revision: 1,
    },
    createIndexesOptions: {
      name: "unique_revision",
      unique: true,
    },
  },
];

export const SAGA_CAUSATION_COLLECTION = "saga_causation_store";
export const SAGA_CAUSATION_COLLECTION_INDICES: Array<MongoIndex> = [
  {
    indexSpecification: {
      saga_id: 1,
      saga_name: 1,
      saga_context: 1,
    },
    createIndexesOptions: {
      name: "path",
      unique: false,
    },
  },
  {
    indexSpecification: {
      saga_id: 1,
      saga_name: 1,
      saga_context: 1,
      causation_id: 1,
    },
    createIndexesOptions: {
      name: "unique_causation",
      unique: true,
    },
  },
];
