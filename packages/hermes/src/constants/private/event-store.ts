import { EventStoreAttributes, StoreIndexes } from "../../types";

export const EVENT_STORE = "event_store";
export const EVENT_STORE_INDEXES: StoreIndexes<EventStoreAttributes> = [
  {
    fields: ["id", "name", "context", "causation_id"],
    name: "est_pkey",
    unique: true,
  },
  {
    fields: ["id", "name", "context"],
    name: "est_idx",
    unique: false,
  },
  {
    fields: ["id", "name", "context", "expected_events"],
    name: "est_key1",
    unique: true,
  },
  {
    fields: ["id", "name", "context", "previous_event_id"],
    name: "est_key2",
    unique: true,
  },
];
