import { EventStoreAttributes, StoreIndexes } from "../types";

export const EVENT_STORE = "event_store";
export const EVENT_STORE_INDEXES: StoreIndexes<EventStoreAttributes> = [
  {
    fields: ["id", "name", "context", "causation_id"],
    name: "event_store_pkey",
    unique: true,
  },
  {
    fields: ["id", "name", "context"],
    name: "event_store_id_name_context_idx",
    unique: false,
  },
  {
    fields: ["id", "name", "context", "expected_events"],
    name: "event_store_id_name_context_expected_events_key",
    unique: true,
  },
  {
    fields: ["id", "name", "context", "previous_event_id"],
    name: "event_store_id_name_context_previous_event_id_key",
    unique: true,
  },
];
