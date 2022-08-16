import { Aggregate } from "../model";
import { AggregateEventHandler } from "../handler";
import { CausationMissingEventsError } from "../error";
import { Command, DomainEvent } from "../message";
import { EventStoreType } from "../enum";
import { ILogger } from "@lindorm-io/winston";
import { MongoEventStore } from "./mongo";
import { PostgresEventStore } from "./postgres";
import { filter, last, take } from "lodash";
import {
  AggregateIdentifier,
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
        break;
    }

    this.logger = logger.createChildLogger(["EventStore"]);
  }

  // public

  public async save(aggregate: IAggregate, causation: Command): Promise<Array<DomainEvent>> {
    const causationEvents = filter<DomainEvent>(aggregate.events, { causationId: causation.id });
    const expectedEvents = take<DomainEvent>(aggregate.events, aggregate.numberOfLoadedEvents);
    const lastExpectedEvent = last<DomainEvent>(expectedEvents);

    if (causationEvents.length === 0) {
      throw new CausationMissingEventsError();
    }

    this.logger.debug("Saving Aggregate", {
      aggregate,
      causationEvents,
      expectedEvents,
      lastExpectedEvent,
    });

    return this.store.save(aggregate, causation, {
      causationEvents,
      expectedEvents: expectedEvents.length,
      previousEventId: lastExpectedEvent ? lastExpectedEvent.id : null,
    });
  }

  public async load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<AggregateEventHandler>,
  ): Promise<Aggregate> {
    const events = await this.store.load(aggregateIdentifier);
    const aggregate = new Aggregate({ ...aggregateIdentifier, eventHandlers }, this.logger);

    for (const event of events) {
      await aggregate.load(event);
    }

    this.logger.debug("Loaded Aggregate", { aggregate: aggregate.toJSON() });

    return aggregate;
  }

  public async events(from: Date, limit: number): Promise<Array<DomainEvent>> {
    return await this.store.events(from, limit);
  }
}
