import EventEmitter from "events";
import { DomainEvent, ReplayEvent } from "../message";
import { EventStore, MessageBus, ViewStore } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";
import { ReplayEventName } from "../enum";
import { flatten, last, uniqBy } from "lodash";
import { intervalToDuration } from "date-fns";
import {
  AggregateIdentifier,
  Data,
  EventEmitterListener,
  EventStoreAttributes,
  IReplayDomain,
  ReplayDomainOptions,
  ReplayEventData,
  ReplayOptions,
} from "../types";

export class ReplayDomain implements IReplayDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly messageBus: MessageBus;
  private readonly eventStore: EventStore;
  private readonly viewStore: ViewStore;
  private readonly logger: Logger;
  private readonly context: string;

  public constructor(options: ReplayDomainOptions) {
    this.logger = options.logger.createChildLogger(["ReplayDomain"]);

    this.messageBus = options.messageBus;
    this.eventStore = options.eventStore;
    this.viewStore = options.viewStore;

    this.eventEmitter = new EventEmitter();
    this.context = options.context;
  }

  // public properties

  public get aggregate(): AggregateIdentifier {
    return { id: "replay", name: "replay", context: this.context };
  }
  public set aggregate(_: AggregateIdentifier) {
    /* ignored */
  }

  // public

  public on<D = Data>(eventName: string, listener: EventEmitterListener<D>): void {
    this.eventEmitter.on(eventName, listener);
  }

  public async replay(options: ReplayOptions = {}): Promise<void> {
    const data: ReplayEventData = {
      dropView: {
        completed: [],
        remaining: [],
        delay: options.delay?.dropView || 2000,
      },
      moveView: {
        completed: [],
        remaining: options.views,
        delay: options.delay?.moveView || 2000,
        suffix: options.suffix || "backup",
      },
      publishEvents: {
        amount: 0,
        contexts: options.aggregateContexts || [this.context],
        delay: options.delay?.publishEvents || 2000,
        previous: [],
      },
      start: {
        delay: options.delay?.start || 2000,
        timestamp: new Date(),
      },
    };

    await this.messageBus.publish(
      new ReplayEvent<ReplayEventData>({
        name: ReplayEventName.START,
        aggregate: this.aggregate,
        data,
        mandatory: true,
      }),
    );
  }

  public async subscribe(): Promise<void> {
    await this.messageBus.subscribe([
      {
        callback: this.handleStart.bind(this),
        queue: this.getQueue(ReplayEventName.START),
        routingKey: this.getRoutingKey(ReplayEventName.START),
      },
      {
        callback: this.handleMoveView.bind(this),
        queue: this.getQueue(ReplayEventName.MOVE_VIEW),
        routingKey: this.getRoutingKey(ReplayEventName.MOVE_VIEW),
      },
      {
        callback: this.handleDropView.bind(this),
        queue: this.getQueue(ReplayEventName.DROP_VIEW),
        routingKey: this.getRoutingKey(ReplayEventName.DROP_VIEW),
      },
      {
        callback: this.handlePublishEvents.bind(this),
        queue: this.getQueue(ReplayEventName.PUBLISH_EVENTS),
        routingKey: this.getRoutingKey(ReplayEventName.PUBLISH_EVENTS),
      },
      {
        callback: this.handleStop.bind(this),
        queue: this.getQueue(ReplayEventName.STOP),
        routingKey: this.getRoutingKey(ReplayEventName.STOP),
      },
    ]);
  }

  // private

  private async handleStart(event: ReplayEvent<ReplayEventData>): Promise<void> {
    this.logger.debug("Handling event", { event });

    this.eventEmitter.emit(ReplayEventName.START);

    let name = ReplayEventName.PUBLISH_EVENTS;

    if (event.data.moveView.remaining.length) {
      name = ReplayEventName.MOVE_VIEW;
    }

    await this.messageBus.publish(
      new ReplayEvent<ReplayEventData>(
        {
          name,
          aggregate: event.aggregate,
          data: event.data,
          delay: event.data.start.delay,
        },
        event,
      ),
    );
  }

  private async handleMoveView(event: ReplayEvent<ReplayEventData>): Promise<void> {
    this.logger.debug("Handling event", { event });

    if (!event.data.moveView.remaining.length) {
      return this.messageBus.publish(
        new ReplayEvent<ReplayEventData>(
          {
            name: ReplayEventName.PUBLISH_EVENTS,
            aggregate: event.aggregate,
            data: event.data,
            delay: event.data.moveView.delay,
            mandatory: true,
          },
          event,
        ),
      );
    }

    const [view, ...remaining] = event.data.moveView.remaining;
    const newName = `${view}_${event.data.moveView.suffix}`;
    const completed = flatten([event.data.moveView.completed, view]);

    await this.viewStore.renameCollection(view, newName);

    this.logger.debug("Moved view", {
      previousName: view,
      newName,
    });

    this.eventEmitter.emit(ReplayEventName.MOVE_VIEW, {
      previousName: view,
      newName,
    });

    await this.messageBus.publish(
      new ReplayEvent<ReplayEventData>(
        {
          name: ReplayEventName.DROP_VIEW,
          aggregate: event.aggregate,
          data: {
            ...event.data,
            dropView: {
              ...event.data.dropView,
              remaining: completed,
            },
            moveView: {
              ...event.data.moveView,
              completed,
              remaining,
            },
          },
          delay: event.data.moveView.delay,
          mandatory: true,
        },
        event,
      ),
    );
  }

  private async handlePublishEvents(event: ReplayEvent<ReplayEventData>): Promise<void> {
    this.logger.debug("Handling event", { event });

    const documents = await this.queryEvents(event);
    const domainEvents = this.filterDomainEvents(documents, event);

    if (!domainEvents.length) {
      return this.messageBus.publish(
        new ReplayEvent<ReplayEventData>({
          name: ReplayEventName.DROP_VIEW,
          aggregate: event.aggregate,
          data: event.data,
          delay: event.data.publishEvents.delay,
        }),
      );
    }

    this.eventEmitter.emit(ReplayEventName.PUBLISH_EVENTS);

    await this.messageBus.publish(domainEvents);

    const published = domainEvents.map((item) => item.id);

    this.logger.debug("Published events", {
      published,
    });

    await this.messageBus.publish(
      new ReplayEvent<ReplayEventData>({
        name: ReplayEventName.PUBLISH_EVENTS,
        aggregate: event.aggregate,
        data: {
          ...event.data,
          publishEvents: {
            ...event.data.publishEvents,
            amount: event.data.publishEvents.amount + domainEvents.length,
            timestamp: last(documents).timestamp,
            previous: published,
          },
        },
        delay: event.data.publishEvents.delay,
      }),
    );
  }

  private async handleDropView(event: ReplayEvent<ReplayEventData>): Promise<void> {
    this.logger.debug("Handling event", { event });

    if (!event.data.dropView.remaining.length) {
      return this.messageBus.publish(
        new ReplayEvent<ReplayEventData>(
          {
            name: ReplayEventName.STOP,
            aggregate: event.aggregate,
            data: event.data,
            delay: event.data.dropView.delay,
          },
          event,
        ),
      );
    }

    const [view, ...remaining] = event.data.dropView.remaining;
    const completed = flatten([event.data.dropView.completed, view]);

    await this.viewStore.dropCollection(view);

    this.logger.debug("Dropped view", {
      view,
    });

    this.eventEmitter.emit(ReplayEventName.DROP_VIEW, {
      collectionName: view,
    });

    return this.messageBus.publish(
      new ReplayEvent<ReplayEventData>(
        {
          name: ReplayEventName.DROP_VIEW,
          aggregate: event.aggregate,
          data: {
            ...event.data,
            dropView: {
              ...event.data.dropView,
              completed,
              remaining,
            },
          },
          delay: event.data.dropView.delay,
        },
        event,
      ),
    );
  }

  private async handleStop(event: ReplayEvent<ReplayEventData>): Promise<void> {
    this.logger.debug("Handling event", { event });

    this.eventEmitter.emit(ReplayEventName.STOP);

    const duration = intervalToDuration({
      start: event.data.start.timestamp,
      end: event.timestamp,
    });

    this.logger.info("Replay complete", {
      ...event.data,
      duration,
    });
  }

  // private helpers

  private async queryEvents(
    event: ReplayEvent<ReplayEventData>,
  ): Promise<Array<EventStoreAttributes>> {
    return await this.eventStore.query(
      {
        context: this.context,
        ...(event.data.publishEvents.timestamp
          ? { timestamp: { $gte: event.data.publishEvents.timestamp } }
          : {}),
      },
      {
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
        limit: 25,
      },
    );
  }

  private filterDomainEvents(
    documents: Array<EventStoreAttributes>,
    replayEvent: ReplayEvent<ReplayEventData>,
  ): Array<DomainEvent> {
    this.logger.debug("Filtering documents", { documents });

    const previous = replayEvent.data.publishEvents.previous;
    const domainEvents: Array<DomainEvent> = [];

    for (const aggregate of documents) {
      if (aggregate.context !== this.context) continue;

      for (const event of aggregate.events) {
        if (previous.includes(event.id)) continue;

        domainEvents.push(
          new DomainEvent({
            id: event.id,
            name: event.name,
            aggregate: {
              id: aggregate.id,
              name: aggregate.name,
              context: aggregate.context,
            },
            causationId: event.causationId,
            correlationId: event.correlationId,
            data: event.data,
            timestamp: new Date(event.timestamp),
          }),
        );
      }
    }

    const unique = uniqBy(domainEvents, "id");

    this.logger.debug("Returning events", { events: unique });

    return unique;
  }

  // private static

  private getQueue(eventName: string): string {
    return `queue.replay.${this.context}.replay.${eventName}`;
  }

  private getRoutingKey(eventName: string): string {
    return `${this.context}.replay.${eventName}`;
  }
}
