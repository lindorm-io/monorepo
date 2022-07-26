import EventEmitter from "events";
import { DomainEvent, ReplayEvent } from "../message";
import { EventStore, MessageBus, ViewStore } from "../infrastructure";
import { Logger } from "@lindorm-io/winston";
import { ReplayEventName } from "../enum";
import { flatten, last, uniqBy } from "lodash";
import { intervalToDuration } from "date-fns";
import {
  AggregateIdentifier,
  EventStoreAttributes,
  IReplayDomain,
  ReplayDomainOptions,
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

  public on(eventName: string, listener: () => void): void {
    this.eventEmitter.on(eventName, listener);
  }

  public async replay(options: ReplayOptions = {}): Promise<void> {
    await this.messageBus.publish(
      new ReplayEvent({
        name: ReplayEventName.START,
        aggregate: this.aggregate,
        data: { ...options, startDate: new Date(), startDelay: options.startDelay || 2000 },
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
        callback: this.handleDropView.bind(this),
        queue: this.getQueue(ReplayEventName.DROP_VIEWS),
        routingKey: this.getRoutingKey(ReplayEventName.DROP_VIEWS),
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

  private async handleStart(replayEvent: ReplayEvent): Promise<void> {
    this.logger.debug("Handling event", { event: replayEvent });

    this.eventEmitter.emit(ReplayEventName.START);

    let name = ReplayEventName.PUBLISH_EVENTS;

    if (replayEvent.data.dropViews.length) {
      name = ReplayEventName.DROP_VIEWS;
    }

    await this.messageBus.publish(
      new ReplayEvent(
        {
          name,
          aggregate: replayEvent.aggregate,
          data: replayEvent.data,
          delay: replayEvent.data.startDelay,
        },
        replayEvent,
      ),
    );
  }

  private async handleDropView(replayEvent: ReplayEvent): Promise<void> {
    this.logger.debug("Handling event", { event: replayEvent });

    if (!replayEvent.data.dropViews.length) {
      return this.messageBus.publish(
        new ReplayEvent(
          {
            name: ReplayEventName.PUBLISH_EVENTS,
            aggregate: replayEvent.aggregate,
            data: replayEvent.data,
          },
          replayEvent,
        ),
      );
    }

    this.eventEmitter.emit(ReplayEventName.DROP_VIEWS);

    const [view, ...dropViews] = replayEvent.data.dropViews;
    const droppedViews = replayEvent.data.droppedViews
      ? flatten([replayEvent.data.droppedViews, view])
      : [view];

    await this.viewStore.dropCollection(view);

    this.logger.debug("Dropped view", {
      context: this.context,
      view,
    });

    await this.messageBus.publish(
      new ReplayEvent(
        {
          name: ReplayEventName.DROP_VIEWS,
          aggregate: replayEvent.aggregate,
          data: { ...replayEvent.data, droppedViews, dropViews },
        },
        replayEvent,
      ),
    );
  }

  private async handlePublishEvents(replayEvent: ReplayEvent): Promise<void> {
    this.logger.debug("Handling event", { event: replayEvent });

    const documents = await this.queryEvents(replayEvent);
    const domainEvents = this.filterDomainEvents(documents, replayEvent);

    if (!domainEvents.length) {
      return this.messageBus.publish(
        new ReplayEvent({
          name: ReplayEventName.STOP,
          aggregate: replayEvent.aggregate,
          data: replayEvent.data,
        }),
      );
    }

    this.eventEmitter.emit(ReplayEventName.PUBLISH_EVENTS);

    await this.messageBus.publish(domainEvents);

    const lastDoc = last(documents);
    const lastPublishedEvents = domainEvents.map((item) => item.id);
    const publishedEvents = replayEvent.data.publishedEvents || 0;

    this.logger.debug("Published events", {
      eventStoreTimestamp: lastDoc.timestamp,
      lastPublishedEvents,
      publishedEvents,
    });

    await this.messageBus.publish(
      new ReplayEvent({
        name: ReplayEventName.PUBLISH_EVENTS,
        aggregate: replayEvent.aggregate,
        data: {
          ...replayEvent.data,
          lastPublishedEvents,
          publishedEvents: publishedEvents + lastPublishedEvents.length,
          eventStoreTimestamp: new Date(lastDoc.timestamp),
        },
        delay: 2000,
      }),
    );
  }

  private async handleStop(replayEvent: ReplayEvent): Promise<void> {
    this.eventEmitter.emit(ReplayEventName.STOP);

    const {
      data: { droppedViews, publishedEvents, startDate },
    } = replayEvent;

    const duration = intervalToDuration({
      start: startDate,
      end: replayEvent.timestamp,
    });

    this.logger.info("Replay complete", {
      droppedViews,
      duration,
      publishedEvents,
      time: replayEvent.timestamp.getTime() - startDate.getTime(),
    });
  }

  // private helpers

  private async queryEvents(replayEvent: ReplayEvent): Promise<Array<EventStoreAttributes>> {
    return await this.eventStore.query(
      {
        context: this.context,
        ...(replayEvent.data.eventStoreTimestamp
          ? { timestamp: { $gte: replayEvent.data.eventStoreTimestamp } }
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
    replayEvent: ReplayEvent,
  ): Array<DomainEvent> {
    this.logger.debug("Filtering documents", { documents });

    const lastPublishedEvents = replayEvent.data.lastPublishedEvents || [];
    const domainEvents: Array<DomainEvent> = [];

    for (const aggregate of documents) {
      if (aggregate.context !== this.context) continue;

      for (const event of aggregate.events) {
        if (lastPublishedEvents.includes(event.id)) continue;

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

    const unique = uniqBy(domainEvents, (item) => item.id);

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
