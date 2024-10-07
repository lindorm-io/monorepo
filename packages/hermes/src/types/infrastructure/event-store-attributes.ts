import { Dict } from "@lindorm/types";

export type EventStoreAttributes = {
  aggregate_id: string;
  aggregate_name: string;
  aggregate_context: string;
  causation_id: string;
  checksum: string;
  correlation_id: string;
  data: Dict;
  encrypted: boolean;
  event_id: string;
  event_name: string;
  event_timestamp: Date;
  expected_events: number;
  meta: Dict;
  previous_event_id: string | null;
  version: number;
  created_at: Date;
};

export type MongoEventStoreDocument = {
  aggregate_id: string;
  aggregate_name: string;
  aggregate_context: string;
  causation_id: string;
  correlation_id: string;
  events: Array<{
    id: string;
    checksum: string;
    data: Dict;
    encrypted: boolean;
    meta: Dict;
    name: string;
    timestamp: Date;
    version: number;
  }>;
  expected_events: number;
  previous_event_id: string | null;
  created_at: Date;
};
