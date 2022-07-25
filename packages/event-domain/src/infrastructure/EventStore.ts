import { Aggregate } from "../entity";
import { AggregateEventHandler } from "../handler";
import { CausationMissingEventsError, MongoDuplicateKeyError } from "../error";
import { Command, DomainEvent } from "../message";
import { Document, Filter, FindOptions, Sort } from "mongodb";
import { MongoBase } from "./MongoBase";
import { filter, first, flatten, last, take } from "lodash";
import {
  AggregateIdentifier,
  EventStoreAttributes,
  EventStoreOptions,
  IEventStore,
  State,
} from "../types";

export class EventStore extends MongoBase<EventStoreAttributes> implements IEventStore {
  public constructor(options: EventStoreOptions) {
    super({
      ...options,
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
            revision: 1,
          },
          createIndexesOptions: {
            name: "unique_revision",
            unique: true,
          },
        },
        {
          indexSpecification: {
            id: 1,
            name: 1,
            context: 1,
            loadEvents: 1,
          },
          createIndexesOptions: {
            name: "load_events",
            unique: true,
          },
        },
      ],
    });
  }

  // public

  public async save(aggregate: Aggregate, causation: Command): Promise<Array<DomainEvent>> {
    const start = Date.now();

    const causationEvents = filter<DomainEvent>(aggregate.events, { causationId: causation.id });
    const expectedEvents = take<DomainEvent>(aggregate.events, aggregate.numberOfLoadedEvents);

    this.logger.debug("Saving Aggregate", {
      causationEvents,
      expectedEvents,
    });

    if (causationEvents.length === 0) {
      throw new CausationMissingEventsError();
    }

    const firstNewEvent = first<DomainEvent>(causationEvents);
    const lastExpectedEvent = last<DomainEvent>(expectedEvents);
    const aggregateIdentifier = firstNewEvent.aggregate;

    this.logger.debug("Identified save options", {
      firstNewEvent,
      lastExpectedEvent,
      aggregateIdentifier,
    });

    const events = await this.find(aggregateIdentifier, {
      causationId: firstNewEvent.causationId,
    });

    if (events.length) {
      this.logger.debug("Insert unnecessary", {
        time: Date.now() - start,
      });

      return events;
    }

    const doc: EventStoreAttributes = {
      ...aggregateIdentifier,

      causationId: firstNewEvent.causationId,
      loadEvents: expectedEvents.length,
      revision: lastExpectedEvent ? lastExpectedEvent.id : null,
      timestamp: new Date(),

      events: causationEvents.map((event: DomainEvent) => ({
        id: event.id,
        name: event.name,
        causationId: event.causationId,
        correlationId: event.correlationId,
        data: event.data,
        timestamp: event.timestamp,
      })),
    };

    this.logger.debug("Inserting event document", {
      doc,
    });

    try {
      const result = await this.collection.insertOne(doc);

      this.logger.debug("Aggregate saved", {
        result,
        time: Date.now() - start,
      });

      return causationEvents;
    } catch (err) {
      this.logger.error("Failed to save Aggregate", err);

      if (err.code === 11000) {
        throw new MongoDuplicateKeyError(err.message, err);
      }

      throw err;
    }
  }

  public async load<S extends State = State>(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<AggregateEventHandler>,
  ): Promise<Aggregate<S>> {
    const start = Date.now();

    await this.promise();

    this.logger.debug("Loading Aggregate", {
      aggregateIdentifier,
    });

    const events = await this.find(aggregateIdentifier);

    const aggregate = new Aggregate<S>({ ...aggregateIdentifier, eventHandlers }, this.logger);

    for (const event of events) {
      await aggregate.load(event);
    }

    this.logger.debug("Loaded Aggregate", {
      events,
      time: Date.now() - start,
    });

    return aggregate;
  }

  // private

  private async find(
    aggregateIdentifier: AggregateIdentifier,
    findFilter: Filter<EventStoreAttributes> = {},
    findOptions: FindOptions = {},
  ): Promise<Array<DomainEvent>> {
    const start = Date.now();

    const filter = { ...aggregateIdentifier, ...findFilter };
    const projection: Document = {
      events: 1,
      loadEvents: 1,
    };
    const sort: Sort = {
      loadEvents: 1,
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
      const cursor = await this.collection.find(filter, options);
      const docs = await cursor.toArray();

      if (docs.length) {
        const events = flatten(docs.map((doc) => doc.events)).map(
          (event) =>
            new DomainEvent({
              id: event.id,
              name: event.name,
              aggregate: aggregateIdentifier,
              causationId: event.causationId,
              correlationId: event.correlationId,
              data: event.data,
              timestamp: new Date(event.timestamp),
            }),
        );

        this.logger.debug("Returning array of events", {
          events,
          time: Date.now() - start,
        });

        return events;
      }

      this.logger.debug("Returning empty array", {
        time: Date.now() - start,
      });

      return [];
    } catch (err) {
      this.logger.error("Failed to find events", err);

      throw err;
    }
  }
}
