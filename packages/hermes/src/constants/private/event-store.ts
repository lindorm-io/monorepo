import { EventStoreAttributes, StoreIndexes } from "../../types";

export const EVENT_STORE = "event_store";
export const EVENT_STORE_INDEXES: StoreIndexes<EventStoreAttributes> = [
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_namespace", "causation_id"],
    name: "event_store_pkey",
    unique: true,
  },
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_namespace"],
    name: "event_store_idx",
    unique: false,
  },
  {
    fields: ["aggregate_id", "aggregate_name", "aggregate_namespace", "expected_events"],
    name: "event_store_key1",
    unique: true,
  },
  {
    fields: [
      "aggregate_id",
      "aggregate_name",
      "aggregate_namespace",
      "previous_event_id",
    ],
    name: "event_store_key2",
    unique: true,
  },
];
