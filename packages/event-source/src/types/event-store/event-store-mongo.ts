export interface MongoEventAttributes {
  id: string;
  name: string;
  causationId: string;
  correlationId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface MongoEventStoreAttributes {
  id: string;
  name: string;
  context: string;

  causationId: string;
  events: Array<MongoEventAttributes>;
  expectedEvents: number;
  previousEventId: string | null;
  timestamp: Date;
}
