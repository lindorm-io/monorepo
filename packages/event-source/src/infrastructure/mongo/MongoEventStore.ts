import { Command, DomainEvent } from "../../message";
import { Document, Filter, FindOptions, Sort } from "mongodb";
import { ILogger } from "@lindorm-io/winston";
import { IMongoConnection } from "@lindorm-io/mongo";
import { MongoBase } from "./MongoBase";
import { MongoDuplicateKeyError } from "../../error";
import {
  AggregateIdentifier,
  EventStoreSaveOptions,
  IAggregate,
  IEventStore,
  MongoEventAttributes,
  MongoEventStoreAttributes,
} from "../../types";

export class MongoEventStore extends MongoBase<MongoEventStoreAttributes> implements IEventStore {
  public constructor(connection: IMongoConnection, logger: ILogger) {
    super(
      {
        connection,
        collection: "events",
        indices: [
          {
            indexSpecification: {
              id: 1,
              name: 1,
              context: 1,
              causationId: 1,
            },
            createIndexesOptions: {
              name: "unique_causation",
              unique: true,
            },
          },
          {
            indexSpecification: {
              id: 1,
              name: 1,
              context: 1,
              expectedEvents: 1,
            },
            createIndexesOptions: {
              name: "unique_expected_events",
              unique: true,
            },
          },
          {
            indexSpecification: {
              id: 1,
              name: 1,
              context: 1,
              previousEventId: 1,
            },
            createIndexesOptions: {
              name: "unique_previous_event_id",
              unique: true,
            },
          },
        ],
      },
      logger,
    );
  }

  // public

  public async save(
    aggregate: IAggregate,
    causation: Command,
    options: EventStoreSaveOptions,
  ): Promise<Array<DomainEvent>> {
    const { causationEvents, expectedEvents, previousEventId } = options;

    const events = await this.find(
      {
        id: aggregate.id,
        name: aggregate.name,
        context: aggregate.context,
      },
      { causationId: causation.id },
    );

    if (events.length) {
      this.logger.debug("Found events matching causation");

      return events;
    }

    const array: Array<MongoEventAttributes> = [];
    for (const event of causationEvents) {
      array.push({
        id: event.id,
        name: event.name,
        causationId: event.causationId,
        correlationId: event.correlationId,
        data: event.data,
        timestamp: event.timestamp,
      });
    }

    const doc: MongoEventStoreAttributes = {
      id: aggregate.id,
      name: aggregate.name,
      context: aggregate.context,

      causationId: causation.id,
      events: array,
      expectedEvents,
      previousEventId,
      timestamp: new Date(),
    };

    this.logger.debug("Inserting event document", { doc });

    try {
      const result = await this.collection.insertOne(doc);

      this.logger.debug("Aggregate saved", { result });

      return causationEvents;
    } catch (err) {
      this.logger.error("Failed to save Aggregate", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  public async load(identifier: AggregateIdentifier): Promise<Array<DomainEvent>> {
    await this.promise();

    return await this.find(identifier);
  }

  public async events(from: Date, limit: number): Promise<Array<DomainEvent>> {
    await this.promise();

    const filter: Filter<MongoEventStoreAttributes> = { timestamp: { $gte: from } };
    const options: FindOptions<MongoEventStoreAttributes> = {
      projection: {
        _id: 0,
        id: 1,
        name: 1,
        context: 1,
        events: 1,
        timestamp: 1,
      },
      sort: {
        timestamp: 1,
      },
      limit,
    };

    this.logger.debug("Querying events", {
      from,
      limit,
      filter,
      options,
    });

    try {
      const cursor = this.collection.find(filter, options);
      const docs = await cursor.toArray();

      this.logger.debug("Found events", { docs });

      const array: Array<DomainEvent> = [];
      for (const attribute of docs) {
        for (const event of attribute.events) {
          array.push(
            new DomainEvent({
              id: event.id,
              name: event.name,
              aggregate: {
                id: attribute.id,
                name: attribute.name,
                context: attribute.context,
              },
              causationId: event.causationId,
              correlationId: event.correlationId,
              data: event.data,
              timestamp: event.timestamp,
            }),
          );
        }
      }

      return array;
    } catch (err) {
      this.logger.error("Failed to query events", err);

      throw err;
    }
  }

  // private

  private async find(
    identifier: AggregateIdentifier,
    findFilter: Filter<MongoEventStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<Array<DomainEvent>> {
    const filter = { ...identifier, ...findFilter };
    const projection: Document = {
      events: 1,
      expectedEvents: 1,
    };
    const sort: Sort = {
      expectedEvents: 1,
    };
    const options = {
      ...findOptions,
      projection: findOptions.projection || projection,
      sort: findOptions.sort || sort,
    };

    this.logger.debug("Finding events", {
      filter,
      options,
    });

    await this.promise();

    try {
      const cursor = this.collection.find(filter, options);
      const docs = await cursor.toArray();

      if (!docs.length) {
        this.logger.debug("No events found");

        return [];
      }

      const array: Array<DomainEvent> = [];
      for (const attribute of docs) {
        for (const event of attribute.events) {
          array.push(
            new DomainEvent({
              id: event.id,
              name: event.name,
              aggregate: {
                id: identifier.id,
                name: identifier.name,
                context: identifier.context,
              },
              causationId: event.causationId,
              correlationId: event.correlationId,
              data: event.data,
              timestamp: event.timestamp,
            }),
          );
        }
      }

      this.logger.debug("Found events", { events: array });

      return array;
    } catch (err) {
      this.logger.error("Failed to find events", err);

      throw err;
    }
  }
}
