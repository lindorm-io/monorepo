export interface MongoEventAttributes {
  id: string;
  name: string;
  causationId: string;
  correlationId: string;
  data: Record<string, any>;
  version: number;
  timestamp: Date;
}

export interface MongoEventStoreAttributes {
  id: string;
  name: string;
  context: string;

  causationId: string;
  events: Array<MongoEventAttributes>;
  expectedEvents: number;
  origin: string;
  originator: string | null;
  previousEventId: string | null;
  timestamp: Date;
}
