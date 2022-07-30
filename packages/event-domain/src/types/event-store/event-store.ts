import { Aggregate } from "../../entity";
import { AggregateIdentifier, IAggregate } from "../aggregate";
import { Command, DomainEvent } from "../../message";
import { IAggregateEventHandler } from "../aggregate-event-handler";
import { IMongoConnection } from "@lindorm-io/mongo";
import { IPostgresConnection } from "@lindorm-io/postgres";

export type EventStoreType = "custom" | "postgres" | "mongo";

export interface EventStoreOptions {
  custom?: IEventStore;
  mongo?: IMongoConnection;
  postgres?: IPostgresConnection;
  type: EventStoreType;
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
