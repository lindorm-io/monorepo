import { EventData, EventStoreAttributes, EventStoreFindFilter, IEventStore } from "../../types";
import { filter, find, orderBy, take } from "lodash";
import { isAfter } from "date-fns";

export class MemoryEventStore implements IEventStore {
  public readonly events: Array<EventStoreAttributes>;

  public constructor() {
    this.events = [];
  }

  public async initialise(): Promise<void> {
    /* ignored */
  }

  public async find(findFilter: EventStoreFindFilter): Promise<Array<EventData>> {
    const filtered = filter<EventStoreAttributes>(this.events, findFilter);
    const ordered = orderBy<EventStoreAttributes>(filtered, ["expected_events"], ["asc"]);

    return MemoryEventStore.toEventData(ordered);
  }

  public async insert(attributes: EventStoreAttributes): Promise<void> {
    const found = find(this.events, { causation_id: attributes.causation_id });

    if (found) {
      throw new Error("Causation already exists");
    }

    this.events.push(attributes);
  }

  public async listEvents(from: Date, limit: number): Promise<Array<EventData>> {
    const ordered = orderBy<EventStoreAttributes>(this.events, ["timestamp"], ["asc"]);
    const filtered = filter<EventStoreAttributes>(ordered, (item) => isAfter(item.timestamp, from));
    const limited = take<EventStoreAttributes>(filtered, limit);

    return MemoryEventStore.toEventData(limited);
  }

  // private

  private static toEventData(documents: Array<EventStoreAttributes>): Array<EventData> {
    const result: Array<EventData> = [];

    for (const item of documents) {
      for (const event of item.events) {
        result.push({
          id: event.id,
          name: event.name,
          aggregate: {
            id: item.id,
            name: item.name,
            context: item.context,
          },
          causation_id: item.causation_id,
          correlation_id: item.correlation_id,
          data: event.data,
          origin: item.origin,
          originator: item.originator,
          timestamp: event.timestamp,
          version: event.version,
        });
      }
    }

    return result;
  }
}
