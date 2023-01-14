import { IN_MEMORY_EVENT_STORE } from "./in-memory";
import { EventData, EventStoreAttributes, EventStoreFindFilter, IEventStore } from "../../types";
import { filter, orderBy } from "lodash";
import { isAfter } from "date-fns";

export class MemoryEventStore implements IEventStore {
  public async find(findFilter: EventStoreFindFilter): Promise<Array<EventData>> {
    const filtered = filter<EventStoreAttributes>(IN_MEMORY_EVENT_STORE, findFilter);
    const ordered = orderBy<EventStoreAttributes>(filtered, ["expected_events"], ["asc"]);

    return MemoryEventStore.toEventData(ordered);
  }

  public async insert(attributes: EventStoreAttributes): Promise<void> {
    const found = IN_MEMORY_EVENT_STORE.find((x) => x.causation_id === attributes.causation_id);

    if (found) {
      throw new Error("Causation already exists");
    }

    IN_MEMORY_EVENT_STORE.push(attributes);
  }

  public async listEvents(from: Date, limit: number): Promise<Array<EventData>> {
    const ordered = orderBy<EventStoreAttributes>(IN_MEMORY_EVENT_STORE, ["timestamp"], ["asc"]);
    const filtered = ordered.filter((item) => isAfter(item.timestamp, from));
    const limited = filtered.slice(0, limit);

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
          meta: event.meta,
          timestamp: event.timestamp,
          version: event.version,
        });
      }
    }

    return result;
  }
}
