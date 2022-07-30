import EventEmitter from "events";
import { DomainEvent, ReplayEvent } from "../message";
import { ILogger } from "@lindorm-io/winston";
import { IMessageBus } from "@lindorm-io/amqp";
import { ReplayEventName } from "../enum";
import { last } from "lodash";
import { intervalToDuration } from "date-fns";
import {
  AggregateIdentifier,
  Data,
  EventEmitterListener,
  IDomainEventStore,
  IReplayDomain,
  ReplayDomainOptions,
  ReplayEventData,
  ReplayOptions,
} from "../types";

export class ReplayDomain implements IReplayDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly messageBus: IMessageBus;
  private readonly eventStore: IDomainEventStore;
  private readonly logger: ILogger;
  private readonly context: string;

  public constructor(options: ReplayDomainOptions) {
    this.logger = options.logger.createChildLogger(["ReplayDomain"]);

    this.messageBus = options.messageBus;
    this.eventStore = options.eventStore;

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

    await this.messageBus.publish(
      new ReplayEvent<ReplayEventData>(
        {
          name: ReplayEventName.PUBLISH_EVENTS,
          aggregate: event.aggregate,
          data: event.data,
          delay: event.data.start.delay,
        },
        event,
      ),
    );
  }

  private async handlePublishEvents(event: ReplayEvent<ReplayEventData>): Promise<void> {
    this.logger.debug("Handling event", { event });

    const queriedEvents = await this.queryEvents(event);
    const filteredEvents = this.filterDomainEvents(queriedEvents, event);

    if (!filteredEvents.length) {
      return this.messageBus.publish(
        new ReplayEvent<ReplayEventData>({
          name: ReplayEventName.STOP,
          aggregate: event.aggregate,
          data: event.data,
          delay: event.data.publishEvents.delay,
        }),
      );
    }

    this.eventEmitter.emit(ReplayEventName.PUBLISH_EVENTS);

    await this.messageBus.publish(filteredEvents);

    const published = filteredEvents.map((item) => item.id);

    this.logger.debug("Published events", { published });

    await this.messageBus.publish(
      new ReplayEvent<ReplayEventData>({
        name: ReplayEventName.PUBLISH_EVENTS,
        aggregate: event.aggregate,
        data: {
          ...event.data,
          publishEvents: {
            ...event.data.publishEvents,
            amount: event.data.publishEvents.amount + filteredEvents.length,
            timestamp: last(queriedEvents).timestamp,
            previous: published,
          },
        },
        delay: event.data.publishEvents.delay,
      }),
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

  private async queryEvents(event: ReplayEvent<ReplayEventData>): Promise<Array<DomainEvent>> {
    return await this.eventStore.events(
      event.data.publishEvents.timestamp || new Date("1970-01-01T00:00:00T00:00:01.000Z"),
      25,
    );
  }

  private filterDomainEvents(
    events: Array<DomainEvent>,
    replayEvent: ReplayEvent<ReplayEventData>,
  ): Array<DomainEvent> {
    this.logger.debug("Filtering domain events", { events });

    const previous = replayEvent.data.publishEvents.previous;
    const domainEvents: Array<DomainEvent> = [];

    for (const event of events) {
      if (previous.includes(event.id)) continue;
      domainEvents.push(event);
    }

    this.logger.debug("Returning events", { events: domainEvents });

    return domainEvents;
  }

  // private static

  private getQueue(eventName: string): string {
    return `queue.replay.${this.context}.replay.${eventName}`;
  }

  private getRoutingKey(eventName: string): string {
    return `${this.context}.replay.${eventName}`;
  }
}
