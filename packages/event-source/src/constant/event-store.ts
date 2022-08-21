import { MongoIndex } from "../types";

export const EVENT_COLLECTION = "event_store";
export const EVENT_COLLECTION_INDICES: Array<MongoIndex> = [
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
  {
    indexSpecification: {
      id: 1,
      name: 1,
      context: 1,
      expected_events: 1,
    },
    createIndexesOptions: {
      name: "unique_expected_events",
      unique: true,
    },
  },
  {
    indexSpecification: {
      id: 1,
      name: 1,
      context: 1,
      previous_event_id: 1,
    },
    createIndexesOptions: {
      name: "unique_previous_event_id",
      unique: true,
    },
  },
];
