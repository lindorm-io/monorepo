import { snakeCase } from "@lindorm/case";
import { ILogger } from "@lindorm/logger";
import { Dict } from "@lindorm/types";
import EventEmitter from "events";
import {
  IChecksumDomain,
  IHermesChecksumStore,
  IHermesMessage,
  IHermesMessageBus,
  IHermesRegistry,
} from "../interfaces";
import { ChecksumDomainOptions, RegistryEvent } from "../types";
import { EventEmitterListener } from "../types/event-emitter";
import { recoverEvent } from "../utils/private";

export class ChecksumDomain implements IChecksumDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly logger: ILogger;

  private readonly errorBus: IHermesMessageBus;
  private readonly eventBus: IHermesMessageBus;
  private readonly registry: IHermesRegistry;
  private readonly store: IHermesChecksumStore;

  public constructor(options: ChecksumDomainOptions) {
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.child(["ChecksumDomain"]);

    this.errorBus = options.errorBus;
    this.eventBus = options.eventBus;
    this.registry = options.registry;
    this.store = options.store;
  }

  // public

  public on<D extends Dict = Dict>(evt: string, listener: EventEmitterListener<D>): void {
    this.eventEmitter.on(evt, listener);
  }

  public async registerHandlers(): Promise<void> {
    for (const event of this.registry.events) {
      this.logger.debug("Registering checksum event handler", {
        aggregate: event.aggregate,
        name: event.name,
        version: event.version,
      });

      await this.eventBus.subscribe({
        callback: (event: IHermesMessage) => this.handleEvent(event),
        queue: ChecksumDomain.getQueue(event),
        topic: ChecksumDomain.getTopic(event),
      });

      this.logger.verbose("Event handler registered", {
        aggregate: event.aggregate,
        name: event.name,
        version: event.version,
      });
    }
  }

  // private

  private async handleEvent(message: IHermesMessage): Promise<void> {
    this.logger.debug("Handling event", { message });

    const event = recoverEvent(message);

    try {
      await this.store.verify(message);

      this.logger.debug("Event checksum verified", { message });
    } catch (error: any) {
      this.logger.warn("Event failed checksum verification", error);

      this.eventEmitter.emit("checksum", { error, event, message });

      await this.errorBus.publish(
        this.errorBus.create({
          data: {
            event,
            error: error.toJSON ? error.toJSON() : { ...error },
            message,
          },
          aggregate: message.aggregate,
          causationId: message.id,
          correlationId: message.correlationId,
          mandatory: false,
          meta: message.meta,
          name: snakeCase(error.name),
        }),
      );
    }
  }

  // private static

  private static getQueue(event: RegistryEvent): string {
    return `queue.checksum.${event.aggregate.context}.${event.aggregate.name}.${event.name}`;
  }

  private static getTopic(event: RegistryEvent): string {
    return `${event.aggregate.context}.${event.aggregate.name}.${event.name}`;
  }
}
