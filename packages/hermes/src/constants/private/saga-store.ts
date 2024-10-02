import { SagaCausationAttributes, SagaStoreAttributes, StoreIndexes } from "../../types";

export const SAGA_STORE = "saga_store";
export const SAGA_STORE_INDEXES: StoreIndexes<SagaStoreAttributes> = [
  {
    fields: ["id", "name", "context"],
    name: "saga_store_pkey",
    unique: true,
  },
  {
    fields: ["id", "name", "context", "destroyed"],
    name: "saga_store_idx1",
    unique: false,
  },
  {
    fields: ["id", "name", "context", "hash", "revision"],
    name: "saga_store_idx2",
    unique: false,
  },
];

export const SAGA_CAUSATION = "saga_causation";
export const SAGA_CAUSATION_INDEXES: StoreIndexes<SagaCausationAttributes> = [
  {
    fields: ["id", "name", "context", "causation_id"],
    name: "saga_causation_pkey",
    unique: true,
  },
  {
    fields: ["id", "name", "context"],
    name: "saga_causation_idx",
    unique: false,
  },
];
