import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { MongoSource } from "@lindorm/mongo";
import { PostgresSource } from "@lindorm/postgres";
import { CausationMissingEventsError } from "../errors";
import {
  IAggregate,
  IEventStore,
  IHermesAggregateEventHandler,
  IHermesEventStore,
  IHermesMessage,
} from "../interfaces";
import { HermesEvent } from "../messages";
import { Aggregate } from "../models";
import {
  AggregateIdentifier,
  EventData,
  EventStoreAttributes,
  HermesEventStoreOptions,
} from "../types";
import { createChecksum } from "../utils/private";
import { MongoEventStore } from "./mongo";
import { PostgresEventStore } from "./postgres";

export class EventStore implements IHermesEventStore {
  private readonly store: IEventStore;
  private readonly logger: ILogger;

  public constructor(options: HermesEventStoreOptions) {
    this.logger = options.logger.child(["EventStore"]);

    if (options.custom) {
      this.store = options.custom;
    } else if (options.mongo instanceof MongoSource) {
      this.store = new MongoEventStore(options.mongo, this.logger);
    } else if (options.postgres instanceof PostgresSource) {
      this.store = new PostgresEventStore(options.postgres, this.logger);
    } else {
      throw new LindormError("Invalid EventStore configuration");
    }
  }

  // public

  public async save(
    aggregate: IAggregate,
    causation: IHermesMessage,
  ): Promise<Array<IHermesMessage>> {
    this.logger.debug("Saving aggregate", { aggregate: aggregate.toJSON(), causation });

    const events = await this.store.find({
      id: aggregate.id,
      name: aggregate.name,
      context: aggregate.context,
      causation_id: causation.id,
    });

    if (events?.length) {
      this.logger.debug("Found events matching causation", { events });

      return events.map((item) => new HermesEvent(item));
    }

    const causationEvents = aggregate.events.filter(
      (x) => x.causationId === causation.id,
    );

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
        meta: item.meta,
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
    eventHandlers: Array<IHermesAggregateEventHandler>,
  ): Promise<Aggregate> {
    this.logger.debug("Loading aggregate", { aggregateIdentifier });

    const data = await this.store.find(aggregateIdentifier);

    const events = data.map((item) => this.toHermesEvent(item));

    const aggregate = new Aggregate({
      ...aggregateIdentifier,
      eventHandlers,
      logger: this.logger,
    });

    for (const event of events) {
      await aggregate.load(event);
    }

    this.logger.debug("Loaded aggregate", { aggregate: aggregate.toJSON() });

    return aggregate;
  }

  public async listEvents(from: Date, limit: number): Promise<Array<IHermesMessage>> {
    const dataArray = await this.store.listEvents(from, limit);

    return dataArray.map((item) => this.toHermesEvent(item));
  }

  // private

  private toHermesEvent(data: EventData): HermesEvent {
    return new HermesEvent({
      id: data.id,
      name: data.name,
      aggregate: data.aggregate,
      causationId: data.causation_id,
      correlationId: data.correlation_id,
      data: data.data,
      meta: data.meta,
      timestamp: data.timestamp,
      version: data.version,
    });
  }
}
