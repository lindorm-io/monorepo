import { IMessageBus } from "@lindorm-io/amqp";
import { Logger } from "@lindorm-io/core-logger";
import { LindormError } from "@lindorm-io/errors";
import EventEmitter from "events";
import { snakeCase } from "lodash";
import { HandlerNotRegisteredError } from "../error";
import { ChecksumEventHandlerImplementation } from "../handler";
import { DomainEvent, ErrorMessage } from "../message";
import {
  ChecksumDomainOptions,
  Data,
  EventEmitterListener,
  IChecksumDomain,
  IChecksumEventHandler,
  IDomainChecksumStore,
} from "../types";
import { assertSnakeCase } from "../util";

export class ChecksumDomain implements IChecksumDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly eventHandlers: Array<IChecksumEventHandler>;
  private readonly logger: Logger;
  private readonly messageBus: IMessageBus;
  private readonly store: IDomainChecksumStore;

  public constructor(options: ChecksumDomainOptions, logger: Logger) {
    this.logger = logger.createChildLogger(["ChecksumDomain"]);

    this.messageBus = options.messageBus;
    this.store = options.store;

    this.eventEmitter = new EventEmitter();
    this.eventHandlers = [];
  }

  // public

  public on<TData = Data>(evt: string, listener: EventEmitterListener<TData>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerEventHandler(
    eventHandler: ChecksumEventHandlerImplementation,
  ): Promise<void> {
    this.logger.debug("Registering event handler", {
      name: eventHandler.eventName,
      aggregate: eventHandler.aggregate,
    });

    if (!(eventHandler instanceof ChecksumEventHandlerImplementation)) {
      throw new LindormError("Invalid handler type", {
        data: {
          expect: ChecksumEventHandlerImplementation.name,
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

    assertSnakeCase(eventHandler.aggregate.name);
    assertSnakeCase(eventHandler.aggregate.context);
    assertSnakeCase(eventHandler.eventName);

    this.eventHandlers.push(eventHandler);

    await this.messageBus.subscribe({
      callback: (event: DomainEvent) => this.handleEvent(event),
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

  private async handleEvent(event: DomainEvent): Promise<void> {
    this.logger.debug("Handling event", { event });

    const eventHandler = this.eventHandlers.find(
      (x) =>
        x.eventName === event.name &&
        x.aggregate.name === event.aggregate.name &&
        x.aggregate.context === event.aggregate.context,
    );

    if (!(eventHandler instanceof ChecksumEventHandlerImplementation)) {
      throw new HandlerNotRegisteredError();
    }

    try {
      await this.store.verify(event);

      this.logger.debug("Event checksum verified", { event });
    } catch (err: any) {
      this.logger.warn("Event failed checksum verification", err);

      this.eventEmitter.emit("checksum", { error: err, event });

      await this.messageBus.publish(
        new ErrorMessage(
          {
            name: snakeCase(err.name),
            aggregate: event.aggregate,
            data: {
              error: err,
              message: event,
            },
            mandatory: false,
            metadata: event.metadata,
          },
          event,
        ),
      );
    }
  }

  // private static

  private static getQueue(handler: IChecksumEventHandler): string {
    return `queue.checksum.${handler.aggregate.context}.${handler.aggregate.name}.${handler.eventName}`;
  }

  private static getTopic(handler: IChecksumEventHandler): string {
    return `${handler.aggregate.context}.${handler.aggregate.name}.${handler.eventName}`;
  }
}
