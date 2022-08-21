export interface EventAttributes {
  id: string;
  name: string;
  data: Record<string, any>;
  timestamp: Date;
  version: number;
}

export interface EventStoreAttributes {
  id: string;
  name: string;
  context: string;
  causation_id: string;
  correlation_id: string;
  events: Array<EventAttributes>;
  expected_events: number;
  origin: string;
  originator: string | null;
  previous_event_id: string | null;
  timestamp: Date;
}
