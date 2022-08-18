import { Aggregate } from "../../model";
import { AggregateIdentifier, IAggregate } from "../model";
import { Command, DomainEvent } from "../../message";
import { IAggregateEventHandler } from "../handler";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";

export type EventStorePersistenceType = "custom" | "mongo" | "postgres";

export interface EventStoreOptions {
  custom?: IEventStore;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  type: EventStorePersistenceType;
}

export interface EventStoreSaveOptions {
  causationEvents: Array<DomainEvent>;
  expectedEvents: number;
  previousEventId: string | null;
}

export interface IEventStore {
  save(
    aggregate: IAggregate,
    causation: Command,
    options: EventStoreSaveOptions,
  ): Promise<Array<DomainEvent>>;
  load(aggregateIdentifier: AggregateIdentifier): Promise<Array<DomainEvent>>;
  events(from: Date, limit: number): Promise<Array<DomainEvent>>;
}

export interface IDomainEventStore {
  save(aggregate: IAggregate, causation: Command): Promise<Array<DomainEvent>>;
  load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<IAggregateEventHandler>,
  ): Promise<Aggregate>;
  events(from: Date, limit: number): Promise<Array<DomainEvent>>;
}
