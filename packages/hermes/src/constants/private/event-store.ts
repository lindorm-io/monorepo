import { EventStoreAttributes, StoreIndexes } from "../../types";

export const EVENT_STORE = "event_store";
export const EVENT_STORE_INDEXES: StoreIndexes<EventStoreAttributes> = [
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_context", "causation_id"],
    name: "event_store_pkey",
    unique: true,
  },
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_context"],
    name: "event_store_idx",
    unique: false,
  },
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_context", "expected_events"],
    name: "event_store_key1",
    unique: true,
  },
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_context", "previous_event_id"],
    name: "event_store_key2",
    unique: true,
  },
];
