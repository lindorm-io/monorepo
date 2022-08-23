import { Aggregate } from "../entity";
import { AggregateEventHandlerImplementation } from "../handler";
import { CausationMissingEventsError } from "../error";
import { Command, DomainEvent } from "../message";
import { EventStoreType } from "../enum";
import { ILogger } from "@lindorm-io/winston";
import { MongoEventStore } from "./mongo";
import { PostgresEventStore } from "./postgres";
import { filter, last, take } from "lodash";
import {
  AggregateIdentifier,
  EventData,
  EventStoreOptions,
  IAggregate,
  IDomainEventStore,
  IEventStore,
} from "../types";

export class EventStore implements IDomainEventStore {
  private readonly store: IEventStore;
  private readonly logger: ILogger;

  public constructor(options: EventStoreOptions, logger: ILogger) {
    switch (options.type) {
      case EventStoreType.CUSTOM:
        if (!options.custom) throw new Error("IEventStore not provided");
        this.store = options.custom;
        break;

      case EventStoreType.MONGO:
        if (!options.mongo) throw new Error("Connection not provided");
        this.store = new MongoEventStore(options.mongo, logger);
        break;

      case EventStoreType.POSTGRES:
        if (!options.postgres) throw new Error("Connection not provided");
        this.store = new PostgresEventStore(options.postgres, logger);
        break;

      default:
        throw new Error("Invalid EventStore type");
    }

    this.logger = logger.createChildLogger(["EventStore"]);
  }

  // public

  public async initialise(): Promise<void> {
    await this.store.initialise();
  }

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

    const causationEvents = filter<DomainEvent>(aggregate.events, { causationId: causation.id });
    const expectedEvents = take<DomainEvent>(aggregate.events, aggregate.numberOfLoadedEvents);
    const lastExpectedEvent = last<DomainEvent>(expectedEvents);

    if (causationEvents.length === 0) {
      throw new CausationMissingEventsError();
    }

    this.logger.debug("Saving aggregate", {
      aggregate,
      causationEvents,
      expectedEvents,
      lastExpectedEvent,
    });

    await this.store.insert({
      id: aggregate.id,
      name: aggregate.name,
      context: aggregate.context,
      causation_id: causation.id,
      correlation_id: causation.correlationId,
      events: causationEvents.map((item) => ({
        id: item.id,
        name: item.name,
        data: item.data,
        version: item.version,
        timestamp: item.timestamp,
      })),
      expected_events: expectedEvents.length,
      origin: causation.origin,
      originator: causation.originator,
      previous_event_id: lastExpectedEvent ? lastExpectedEvent.id : null,
      timestamp: new Date(),
    });

    return causationEvents;
  }

  public async load(
    identifier: AggregateIdentifier,
    eventHandlers: Array<AggregateEventHandlerImplementation>,
  ): Promise<Aggregate> {
    this.logger.debug("Loading aggregate", { identifier });

    const data = await this.store.find({
      id: identifier.id,
      name: identifier.name,
      context: identifier.context,
    });

    const events = data.map((item) => this.toDomainEvent(item));

    const aggregate = new Aggregate({ ...identifier, eventHandlers }, this.logger);

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
      origin: data.origin,
      originator: data.originator,
      timestamp: data.timestamp,
      version: data.version,
    });
  }
}
