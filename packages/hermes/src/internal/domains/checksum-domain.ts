import { ShaKit } from "@lindorm/sha";
import type { IIrisMessageBus, IIrisWorkerQueue } from "@lindorm/iris";
import type { ILogger } from "@lindorm/logger";
import type { IProteusSource } from "@lindorm/proteus";
import type { Dict } from "@lindorm/types";
import { sortKeys } from "@lindorm/utils";
import { randomUUID } from "@lindorm/random";
import EventEmitter from "events";
import { ChecksumError } from "../../errors/index.js";
import { ChecksumRecord } from "../entities/index.js";
import { HermesErrorMessage, HermesEventMessage } from "../messages/index.js";
import type { HermesRegistry } from "../registry/index.js";
import { findChecksum, insertChecksum } from "../stores/index.js";

export type ChecksumDomainOptions = {
  registry: HermesRegistry;
  proteus: IProteusSource;
  iris: {
    eventBus: IIrisMessageBus<HermesEventMessage>;
    errorQueue: IIrisWorkerQueue<HermesErrorMessage>;
  };
  logger: ILogger;
};

export type ChecksumEventEmitterListener<D extends Dict = Dict> = (data: D) => void;

export class ChecksumDomain {
  private readonly eventEmitter: EventEmitter;
  private readonly logger: ILogger;
  private readonly registry: HermesRegistry;
  private readonly proteus: IProteusSource;
  private readonly eventBus: IIrisMessageBus<HermesEventMessage>;
  private readonly errorQueue: IIrisWorkerQueue<HermesErrorMessage>;

  public constructor(options: ChecksumDomainOptions) {
    this.eventEmitter = new EventEmitter();
    this.logger = options.logger.child(["ChecksumDomain"]);
    this.registry = options.registry;
    this.proteus = options.proteus;
    this.eventBus = options.iris.eventBus;
    this.errorQueue = options.iris.errorQueue;
  }

  public on<D extends Dict = Dict>(
    evt: string,
    listener: ChecksumEventEmitterListener<D>,
  ): void {
    this.eventEmitter.on(evt, listener);
  }

  public off<D extends Dict = Dict>(
    evt: string,
    listener: ChecksumEventEmitterListener<D>,
  ): void {
    this.eventEmitter.off(evt, listener);
  }

  public removeAllListeners(): void {
    this.eventEmitter.removeAllListeners();
  }

  public async registerHandlers(): Promise<void> {
    for (const aggregate of this.registry.allAggregates) {
      // Only subscribe to events that this aggregate can produce
      for (const handler of aggregate.eventHandlers) {
        const event = this.registry.getEvent(handler.trigger);
        const topic = `${aggregate.namespace}.${aggregate.name}.${event.name}`;
        const queue = `queue.checksum.${aggregate.namespace}.${aggregate.name}.${event.name}`;

        this.logger.debug("Registering checksum event handler", {
          aggregate: { name: aggregate.name, namespace: aggregate.namespace },
          event: { name: event.name, version: event.version },
          topic,
          queue,
        });

        await this.eventBus.subscribe({
          topic,
          queue,
          callback: (message) => this.handleEvent(message),
        });

        this.logger.verbose("Checksum event handler registered", {
          aggregate: { name: aggregate.name, namespace: aggregate.namespace },
          event: { name: event.name, version: event.version },
        });
      }
    }
  }

  private async handleEvent(message: HermesEventMessage): Promise<void> {
    this.logger.debug("Handling event for checksum verification", {
      eventId: message.id,
      name: message.name,
    });

    try {
      await this.verifyAndStoreChecksum(message);

      this.logger.debug("Event checksum verified", { eventId: message.id });
    } catch (error: any) {
      this.logger.warn("Event failed checksum verification", error);

      const errorData = {
        error:
          error instanceof Error ? { name: error.name, message: error.message } : error,
        eventId: message.id,
        name: message.name,
        aggregate: message.aggregate,
      };

      this.eventEmitter.emit("checksum", errorData);

      try {
        const errorMessage = new HermesErrorMessage();
        errorMessage.name = "checksum_error";
        errorMessage.aggregate = message.aggregate;
        errorMessage.causationId = message.id;
        errorMessage.correlationId = message.correlationId;
        errorMessage.data = errorData;
        errorMessage.meta = message.meta;

        await this.errorQueue.publish(errorMessage);

        this.logger.verbose("Published checksum error to error queue", {
          eventId: message.id,
        });
      } catch (publishErr: any) {
        this.logger.error("Failed to publish checksum error to error queue", publishErr);
      }
    }
  }

  private async verifyAndStoreChecksum(message: HermesEventMessage): Promise<void> {
    const checksumRepo = this.proteus.repository(ChecksumRecord);

    const existing = await findChecksum(checksumRepo, message.id);

    const computedChecksum = ChecksumDomain.computeChecksum(message);

    if (existing) {
      if (existing.checksum !== computedChecksum) {
        throw new ChecksumError(
          `Checksum mismatch for event ${message.id}: stored=${existing.checksum}, computed=${computedChecksum}`,
        );
      }
      return;
    }

    const record = new ChecksumRecord();
    record.id = randomUUID();
    record.aggregateId = message.aggregate.id;
    record.aggregateName = message.aggregate.name;
    record.aggregateNamespace = message.aggregate.namespace;
    record.eventId = message.id;
    record.checksum = computedChecksum;

    await insertChecksum(checksumRepo, record);
  }

  private static computeChecksum(message: HermesEventMessage): string {
    const kit = new ShaKit({ algorithm: "SHA256", encoding: "base64" });
    const payload = sortKeys({
      aggregate: message.aggregate,
      causationId: message.causationId,
      correlationId: message.correlationId,
      data: message.data,
      meta: message.meta,
      name: message.name,
      version: message.version,
    });
    return kit.hash(JSON.stringify(payload));
  }
}
