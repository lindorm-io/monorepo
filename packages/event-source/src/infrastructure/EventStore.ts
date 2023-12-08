import { Logger } from "@lindorm-io/core-logger";
import { EventStoreType } from "../enum";
import { CausationMissingEventsError } from "../error";
import { AggregateEventHandlerImplementation } from "../handler";
import { Command, DomainEvent } from "../message";
import { Aggregate } from "../model";
import {
  AggregateIdentifier,
  EventData,
  EventStoreAttributes,
  EventStoreOptions,
  IAggregate,
  IDomainEventStore,
  IEventStore,
} from "../types";
import { createChecksum } from "../util";
import { MemoryEventStore } from "./memory";
import { MongoEventStore } from "./mongo";
import { PostgresEventStore } from "./postgres";

export class EventStore implements IDomainEventStore {
  private readonly store: IEventStore;
  private readonly logger: Logger;

  public constructor(options: EventStoreOptions, logger: Logger) {
    switch (options.type) {
      case EventStoreType.CUSTOM:
        if (!options.custom) throw new Error("Custom EventStore not provided");
        this.store = options.custom;
        break;

      case EventStoreType.MEMORY:
        this.store = new MemoryEventStore();
        break;

      case EventStoreType.MONGO:
        if (!options.mongo) throw new Error("Mongo connection not provided");
        this.store = new MongoEventStore(options.mongo, logger);
        break;

      case EventStoreType.POSTGRES:
        if (!options.postgres) throw new Error("Postgres connection not provided");
        this.store = new PostgresEventStore(options.postgres, logger);
        break;

      default:
        throw new Error("Invalid EventStore type");
    }

    this.logger = logger.createChildLogger(["EventStore"]);
  }

  // public

  public async save(aggregate: IAggregate, causation: Command): Promise<Array<DomainEvent>> {
    this.logger.debug("Saving aggregate", { aggregate: aggregate.toJSON(), causation });

    const events = await this.store.find({
      id: aggregate.id,
      name: aggregate.name,
      context: aggregate.context,
      causation_id: causation.id,
    });

    if (events?.length) {
      this.logger.debug("Found events matching causation", { events });

      return events.map((item) => new DomainEvent(item));
    }

    const causationEvents = aggregate.events.filter((x) => x.causationId === causation.id);

    if (causationEvents.length === 0) {
      throw new CausationMissingEventsError();
    }

    const expectedEvents = aggregate.events.slice(0, aggregate.numberOfLoadedEvents);
    const [lastExpectedEvent] = expectedEvents.reverse();

    this.logger.debug("Saving aggregate", {
      aggregate,
      causationEvents,
      expectedEvents,
      lastExpectedEvent,
    });

    const attributes: Omit<EventStoreAttributes, "checksum"> = {
      id: aggregate.id,
      name: aggregate.name,
      context: aggregate.context,
      causation_id: causation.id,
      correlation_id: causation.correlationId,
      events: causationEvents.map((item) => ({
        id: item.id,
        name: item.name,
        data: item.data,
        meta: item.metadata,
        version: item.version,
        timestamp: item.timestamp,
      })),
      expected_events: expectedEvents.length,
      previous_event_id: lastExpectedEvent ? lastExpectedEvent.id : null,
      timestamp: new Date(),
    };

    const checksum = createChecksum(attributes);

    await this.store.insert({ ...attributes, checksum });

    return causationEvents;
  }

  public async load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<AggregateEventHandlerImplementation>,
  ): Promise<Aggregate> {
    this.logger.debug("Loading aggregate", { aggregateIdentifier });

    const data = await this.store.find(aggregateIdentifier);

    const events = data.map((item) => this.toDomainEvent(item));

    const aggregate = new Aggregate({ ...aggregateIdentifier, eventHandlers }, this.logger);

    for (const event of events) {
      await aggregate.load(event);
    }

    this.logger.debug("Loaded aggregate", { aggregate: aggregate.toJSON() });

    return aggregate;
  }

  public async listEvents(from: Date, limit: number): Promise<Array<DomainEvent>> {
    const dataArray = await this.store.listEvents(from, limit);

    return dataArray.map((item) => this.toDomainEvent(item));
  }

  // private

  private toDomainEvent(data: EventData): DomainEvent {
    return new DomainEvent({
      id: data.id,
      name: data.name,
      aggregate: data.aggregate,
      causationId: data.causation_id,
      correlationId: data.correlation_id,
      data: data.data,
      metadata: data.meta,
      timestamp: data.timestamp,
      version: data.version,
    });
  }
}
