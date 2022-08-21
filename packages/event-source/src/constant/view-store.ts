import { MongoIndex } from "../types";

export const VIEW_COLLECTION_INDICES: Array<MongoIndex> = [
  {
    indexSpecification: {
      id: 1,
      name: 1,
      context: 1,
    },
    createIndexesOptions: {
      name: "unique_id",
      unique: true,
    },
  },
  {
    indexSpecification: {
      id: 1,
      name: 1,
      context: 1,
      destroyed: 1,
    },
    createIndexesOptions: {
      name: "unique_destroyed",
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

export const VIEW_CAUSATION_COLLECTION = "view_causation_store";
export const VIEW_CAUSATION_COLLECTION_INDICES: Array<MongoIndex> = [
  {
    indexSpecification: {
      view_id: 1,
      view_name: 1,
      view_context: 1,
    },
    createIndexesOptions: {
      name: "path",
      unique: false,
    },
  },
  {
    indexSpecification: {
      id: 1,
      name: 1,
      context: 1,
      causation_id: 1,
    },
    createIndexesOptions: {
      name: "unique_causation",
      unique: true,
    },
  },
];
