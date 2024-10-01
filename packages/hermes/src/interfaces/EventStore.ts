import { EventStoreAttributes, EventStoreFindFilter } from "../types";

export interface IEventStore {
  find(filter: EventStoreFindFilter): Promise<Array<EventStoreAttributes>>;
  insert(attributes: Array<EventStoreAttributes>): Promise<void>;
  listEvents(from: Date, limit: number): Promise<Array<EventStoreAttributes>>;
}
