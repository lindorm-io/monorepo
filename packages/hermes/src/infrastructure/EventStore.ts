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
  EventStoreAttributes,
  HermesEventStoreOptions,
} from "../types";
import { assertChecksum, createChecksum } from "../utils/private";
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

      return events.map((item) => EventStore.toHermesEvent(item));
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

    const initialAttributes: Array<Omit<EventStoreAttributes, "checksum">> =
      causationEvents.map((event) => ({
        aggregate_id: aggregate.id,
        aggregate_name: aggregate.name,
        aggregate_context: aggregate.context,
        causation_id: causation.id,
        correlation_id: causation.correlationId,
        data: event.data,
        event_id: event.id,
        event_name: event.name,
        event_timestamp: event.timestamp,
        expected_events: expectedEvents.length,
        meta: event.meta,
        previous_event_id: lastExpectedEvent ? lastExpectedEvent.id : null,
        timestamp: new Date(),
        version: event.version,
      }));

    const attributes: Array<EventStoreAttributes> = initialAttributes.map((item) => ({
      ...item,
      checksum: createChecksum(item),
    }));

    await this.store.insert(attributes);

    return causationEvents;
  }

  public async load(
    aggregateIdentifier: AggregateIdentifier,
    eventHandlers: Array<IHermesAggregateEventHandler>,
  ): Promise<Aggregate> {
    this.logger.debug("Loading aggregate", { aggregateIdentifier });

    const data = await this.store.find(aggregateIdentifier);

    this.warnIfChecksumMismatch(data);

    const events = data.map((item) => EventStore.toHermesEvent(item));

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

    return dataArray.map((item) => EventStore.toHermesEvent(item));
  }

  // private

  private static toHermesEvent(data: EventStoreAttributes): HermesEvent {
    return new HermesEvent({
      id: data.event_id,
      name: data.event_name,
      aggregate: {
        id: data.aggregate_id,
        name: data.aggregate_name,
        context: data.aggregate_context,
      },
      causationId: data.causation_id,
      correlationId: data.correlation_id,
      data: data.data,
      meta: data.meta,
      timestamp: data.event_timestamp,
      version: data.version,
    });
  }

  private async warnIfChecksumMismatch(
    attributes: Array<EventStoreAttributes>,
  ): Promise<void> {
    for (const event of attributes) {
      try {
        assertChecksum(event);
      } catch (error: any) {
        this.logger.warn("Checksum mismatch", error, [{ event }]);
      }
    }
  }
}
