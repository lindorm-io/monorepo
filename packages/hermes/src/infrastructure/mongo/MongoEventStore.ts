import { ILogger } from "@lindorm/logger";
import { IMongoSource } from "@lindorm/mongo";
import { Collection } from "mongodb";
import { EVENT_STORE, EVENT_STORE_INDEXES } from "../../constants/private";
import { MongoDuplicateKeyError } from "../../errors";
import { IEventStore } from "../../interfaces";
import {
  EventStoreAttributes,
  EventStoreFindFilter,
  MongoEventStoreDocument,
} from "../../types";
import { MongoBase } from "./MongoBase";

export class MongoEventStore extends MongoBase implements IEventStore {
  private promise: () => Promise<void>;

  public constructor(source: IMongoSource, logger: ILogger) {
    super(source, logger);

    this.promise = this.initialise;
  }

  // public

  public async find(filter: EventStoreFindFilter): Promise<Array<EventStoreAttributes>> {
    this.logger.debug("Finding event documents", { filter });

    await this.promise();

    try {
      const collection = await this.eventCollection();

      const cursor = collection.find(
        {
          aggregate_id: filter.id,
          aggregate_name: filter.name,
          aggregate_context: filter.context,
          ...(filter.causation_id ? { causation_id: filter.causation_id } : {}),
        },
        {
          sort: { expected_events: 1 },
        },
      );

      const documents = await cursor.toArray();

      this.logger.debug("Found event documents", { documents });

      if (!documents.length) return [];

      return MongoEventStore.toAttributes(documents);
    } catch (err: any) {
      this.logger.error("Failed to find event documents", err);

      throw err;
    }
  }

  public async insert(attributes: Array<EventStoreAttributes>): Promise<void> {
    this.logger.debug("Inserting event document", { attributes });

    await this.promise();

    try {
      const collection = await this.eventCollection();

      const result = await collection.insertOne(MongoEventStore.toDocument(attributes));

      this.logger.verbose("Inserted event document", { result });
    } catch (err: any) {
      this.logger.error("Failed to insert event document", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  public async listEvents(
    from: Date,
    limit: number,
  ): Promise<Array<EventStoreAttributes>> {
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

      return MongoEventStore.toAttributes(documents);
    } catch (err: any) {
      this.logger.error("Failed to list event documents", err);

      throw err;
    }
  }

  // private

  private async initialise(): Promise<void> {
    await this.connect();
    await this.createIndexes(EVENT_STORE, EVENT_STORE_INDEXES);

    this.promise = (): Promise<void> => Promise.resolve();
  }

  private async eventCollection(): Promise<Collection<MongoEventStoreDocument>> {
    return this.source.database.collection<MongoEventStoreDocument>(EVENT_STORE);
  }

  // private static

  private static toDocument(
    attributes: Array<EventStoreAttributes>,
  ): MongoEventStoreDocument {
    const [first] = attributes;

    const result: MongoEventStoreDocument = {
      aggregate_id: first.aggregate_id,
      aggregate_name: first.aggregate_name,
      aggregate_context: first.aggregate_context,
      causation_id: first.causation_id,
      correlation_id: first.correlation_id,
      events: [],
      expected_events: first.expected_events,
      previous_event_id: first.previous_event_id,
      timestamp: first.timestamp,
    };

    for (const item of attributes) {
      result.events.push({
        id: item.event_id,
        checksum: item.checksum,
        data: item.data,
        encrypted: item.encrypted,
        meta: item.meta,
        name: item.event_name,
        timestamp: item.event_timestamp,
        version: item.version,
      });
    }

    return result;
  }

  private static toAttributes(
    documents: Array<MongoEventStoreDocument>,
  ): Array<EventStoreAttributes> {
    const result: Array<EventStoreAttributes> = [];

    for (const document of documents) {
      for (const event of document.events) {
        result.push({
          aggregate_id: document.aggregate_id,
          aggregate_name: document.aggregate_name,
          aggregate_context: document.aggregate_context,
          causation_id: document.causation_id,
          checksum: event.checksum,
          correlation_id: document.correlation_id,
          encrypted: event.encrypted,
          data: event.data,
          event_id: event.id,
          event_name: event.name,
          event_timestamp: event.timestamp,
          expected_events: document.expected_events,
          meta: event.meta,
          previous_event_id: document.previous_event_id,
          timestamp: document.timestamp,
          version: event.version,
        });
      }
    }

    return result;
  }
}
