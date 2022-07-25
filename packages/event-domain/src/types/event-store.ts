import { Aggregate } from "../entity";
import { AggregateEventHandler } from "../handler";
import { AggregateIdentifier } from "./aggregate";
import { Command, DomainEvent } from "../message";
import { Logger } from "@lindorm-io/winston";
import { MongoConnection } from "@lindorm-io/mongo";

export interface EventAttributes {
  id: string;
  name: string;
  causationId: string;
  correlationId: string;
  data: Record<string, any>;
  timestamp: Date;
}

export interface EventStoreAttributes {
  id: string;
  name: string;
  context: string;

  causationId: string;
  events: Array<EventAttributes>;
  loadEvents: number;
  revision: string | null;
  timestamp: Date;
}

export interface EventStoreOptions {
  connection: MongoConnection;
  database?: string;
  logger: Logger;
}

export interface IEventStore {
  save(aggregate: Aggregate, causation: Command): Promise<Array<DomainEvent>>;
  load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<AggregateEventHandler>,
  ): Promise<Aggregate>;
}
