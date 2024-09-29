import { snakeCase } from "@lindorm/case";
import { LindormError } from "@lindorm/errors";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import EventEmitter from "events";
import { HandlerNotRegisteredError } from "../errors";
import { HermesChecksumEventHandler } from "../handlers";
import {
  IChecksumDomain,
  IHermesChecksumEventHandler,
  IHermesChecksumStore,
  IHermesMessage,
  IHermesMessageBus,
} from "../interfaces";
import { HermesError, HermesEvent } from "../messages";
import { ChecksumDomainOptions } from "../types";
import { EventEmitterListener } from "../types/event-emitter";

export class ChecksumDomain implements IChecksumDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<IHermesChecksumEventHandler>;
  private readonly logger: ILogger;
  private readonly messageBus: IHermesMessageBus;
  private readonly store: IHermesChecksumStore;

  public constructor(options: ChecksumDomainOptions) {
    this.logger = options.logger.child(["ChecksumDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventEmitter = new EventEmitter();
    this.eventHandlers = [];
  }

  // public

  public on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerEventHandler(
    eventHandler: IHermesChecksumEventHandler,
  ): Promise<void> {
    this.logger.debug("Registering event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
    });

    if (!(eventHandler instanceof HermesChecksumEventHandler)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: HermesChecksumEventHandler.name,
          actual: typeof eventHandler,
        },
      });
    }

    const existingHandler = this.eventHandlers.some(
      (x) =>
        x.eventName === eventHandler.eventName &&
        x.aggregate.name === eventHandler.aggregate.name &&
        x.aggregate.context === eventHandler.aggregate.context,
    );

    if (existingHandler) {
      throw new LindormError("Event handler already registered", {
        debug: {
          eventName: eventHandler.eventName,
          aggregate: {
            name: eventHandler.aggregate.name,
            context: eventHandler.aggregate.context,
          },
        },
      });
    }

    this.eventHandlers.push(eventHandler);

    await this.messageBus.subscribe({
      callback: (event: HermesEvent) => this.handleEvent(event),
      queue: ChecksumDomain.getQueue(eventHandler),
      topic: ChecksumDomain.getTopic(eventHandler),
    });

    this.logger.verbose("Event handler registered", {
      eventName: eventHandler.eventName,
      aggregate: {
        name: eventHandler.aggregate.name,
        context: eventHandler.aggregate.context,
      },
    });
  }

  // private

  private async handleEvent(event: IHermesMessage): Promise<void> {
    this.logger.debug("Handling event", { event });

    const eventHandler = this.eventHandlers.find(
      (x) =>
        x.eventName === event.name &&
        x.aggregate.name === event.aggregate.name &&
        x.aggregate.context === event.aggregate.context,
    );

    if (!(eventHandler instanceof HermesChecksumEventHandler)) {
      throw new HandlerNotRegisteredError();
    }

    try {
      await this.store.verify(event);

      this.logger.debug("Event checksum verified", { event });
    } catch (err: any) {
      this.logger.warn("Event failed checksum verification", err);

      this.eventEmitter.emit("checksum", { error: err, event });

      await this.messageBus.publish(
        new HermesError(
          {
            name: snakeCase(err.name),
            aggregate: event.aggregate,
            data: {
              error: err,
              message: event,
            },
            mandatory: false,
            meta: event.meta,
          },
          event,
        ),
      );
    }
  }

  // private static

  private static getQueue(handler: IHermesChecksumEventHandler): string {
    return `queue.checksum.${handler.aggregate.context}.${handler.aggregate.name}.${handler.eventName}`;
  }

  private static getTopic(handler: IHermesChecksumEventHandler): string {
    return `${handler.aggregate.context}.${handler.aggregate.name}.${handler.eventName}`;
  }
}
