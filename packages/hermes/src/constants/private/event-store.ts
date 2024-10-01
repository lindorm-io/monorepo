import { EventStoreAttributes, StoreIndexes } from "../../types";

export const EVENT_STORE = "event_store";
export const EVENT_STORE_INDEXES: StoreIndexes<EventStoreAttributes> = [
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_context", "causation_id"],
    name: "est_pkey",
    unique: true,
  },
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_context"],
    name: "est_idx",
    unique: false,
  },
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_context", "expected_events"],
    name: "est_key1",
    unique: true,
  },
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_context", "previous_event_id"],
    name: "est_key2",
    unique: true,
  },
];
