import { Collection } from "mongodb";
import { EVENT_STORE, EVENT_STORE_INDEXES } from "../../constant";
import { EventData, EventStoreAttributes, EventStoreFindFilter, IEventStore } from "../../types";
import { Logger } from "@lindorm-io/core-logger";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoBase } from "./MongoBase";
import { MongoDuplicateKeyError } from "../../error";

export class MongoEventStore extends MongoBase implements IEventStore {
  private promise: () => Promise<void>;

  public constructor(connection: IMongoConnection, logger: Logger) {
    super(connection, logger);

    this.promise = this.initialise;
  }

  // public

  public async find(filter: EventStoreFindFilter): Promise<Array<EventData>> {
    this.logger.debug("Finding event documents", { filter });

    await this.promise();

    try {
      const collection = await this.eventCollection();

      const cursor = collection.find(filter, {
        sort: { expected_events: 1 },
      });

      const documents = await cursor.toArray();

      this.logger.debug("Found event documents", { documents });

      if (!documents.length) return [];

      return MongoEventStore.toEventData(documents);
    } catch (err: any) {
      this.logger.error("Failed to find event documents", err);

      throw err;
    }
  }

  public async insert(data: EventStoreAttributes): Promise<void> {
    this.logger.debug("Inserting event document", { data });

    await this.promise();

    try {
      const collection = await this.eventCollection();

      const result = await collection.insertOne({
        id: data.id,
        name: data.name,
        context: data.context,
        causation_id: data.causation_id,
        correlation_id: data.correlation_id,
        events: data.events,
        expected_events: data.expected_events,
        previous_event_id: data.previous_event_id,
        timestamp: data.timestamp,
      });

      this.logger.verbose("Inserted event document", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert event document", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  public async listEvents(from: Date, limit: number): Promise<Array<EventData>> {
    this.logger.debug("Listing event documents", { from, limit });

    await this.promise();

    try {
      const collection = await this.eventCollection();

      const cursor = collection.find(
        { timestamp: { $gte: from } },
        {
          sort: { timestamp: 1 },
          limit,
        },
      );

      const documents = await cursor.toArray();

      this.logger.debug("Found event documents", { documents });

      return MongoEventStore.toEventData(documents);
    } catch (err: any) {
      this.logger.error("Failed to list event documents", err);

      throw err;
    }
  }

  // private

  private async initialise(): Promise<void> {
    await this.createIndexes(EVENT_STORE, EVENT_STORE_INDEXES);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async eventCollection(): Promise<Collection<EventStoreAttributes>> {
    return this.connection.database.collection<EventStoreAttributes>(EVENT_STORE);
  }

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
