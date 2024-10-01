import {
  AggregateIdentifier,
  EventStoreAttributes,
  EventStoreFindFilter,
} from "../types";
import { IAggregate } from "./Aggregate";
import { IHermesAggregateEventHandler } from "./AggregateEventHandler";
import { IHermesMessage } from "./HermesMessage";

export interface IHermesEventStore {
  listEvents(from: Date, limit: number): Promise<Array<IHermesMessage>>;
  load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<IHermesAggregateEventHandler>,
  ): Promise<IAggregate>;
  save(aggregate: IAggregate, causation: IHermesMessage): Promise<Array<IHermesMessage>>;
}

export interface IEventStore {
  find(filter: EventStoreFindFilter): Promise<Array<EventStoreAttributes>>;
  insert(attributes: Array<EventStoreAttributes>): Promise<void>;
  listEvents(from: Date, limit: number): Promise<Array<EventStoreAttributes>>;
}
