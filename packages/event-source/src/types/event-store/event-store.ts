import { Aggregate } from "../../model";
import { AggregateIdentifier, IAggregate } from "../model";
import { Command, DomainEvent } from "../../message";
import { EventStoreAttributes } from "./event-store-attributes";
import { IAggregateEventHandler } from "../handler";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";

export type EventStoreAdapterType = "custom" | "memory" | "mongo" | "postgres";

export interface EventStoreOptions {
  custom?: IEventStore;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  type: EventStoreAdapterType;
}

export interface EventData {
  id: string;
  aggregate: AggregateIdentifier;
  causation_id: string;
  correlation_id: string;
  data: Record<string, any>;
  meta: Record<string, any>;
  name: string;
  timestamp: Date;
  version: number;
}

export interface EventStoreFindFilter {
  id: string;
  name: string;
  context: string;
  causation_id?: string;
}

export interface IDomainEventStore {
  listEvents(from: Date, limit: number): Promise<Array<DomainEvent>>;
  load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<IAggregateEventHandler>,
  ): Promise<Aggregate>;
  save(aggregate: IAggregate, causation: Command): Promise<Array<DomainEvent>>;
}

export interface IEventStore {
  find(filter: EventStoreFindFilter): Promise<Array<EventData>>;
  insert(attributes: EventStoreAttributes): Promise<void>;
  listEvents(from: Date, limit: number): Promise<Array<EventData>>;
}
