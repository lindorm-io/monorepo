import { SagaStoreAttributes, SagaCausationAttributes, StoreIndexes } from "../types";

export const SAGA_STORE = "saga_store";
export const SAGA_STORE_INDEXES: StoreIndexes<SagaStoreAttributes> = [
  {
    fields: ["id", "name", "context"],
    name: "saga_store_pkey",
    unique: true,
  },
  {
    fields: ["id", "name", "context", "destroyed"],
    name: "saga_store_id_name_context_destroyed_idx",
    unique: false,
  },
  {
    fields: ["id", "name", "context", "hash", "revision"],
    name: "saga_store_id_name_context_hash_revision_idx",
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
    name: "saga_causation_id_name_context_idx",
    unique: false,
  },
];
