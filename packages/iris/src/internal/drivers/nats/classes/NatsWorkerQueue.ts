import { randomUUID } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces";
import type { ConsumeEnvelope, ConsumeOptions, PublishOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { NatsSharedState } from "../types/nats-types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { DriverWorkerQueueBase } from "../../../classes/DriverWorkerQueueBase";
import { publishNatsMessages } from "../utils/publish-nats-messages";
import { wrapNatsConsumer } from "../utils/wrap-nats-consumer";
import { createNatsConsumer } from "../utils/create-nats-consumer";
import { resolveSubject } from "../utils/resolve-subject";
import { resolveConsumerName } from "../utils/resolve-consumer-name";
import { stopNatsConsumer } from "../utils/stop-nats-consumer";

export type NatsWorkerQueueOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: NatsSharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

type OwnedConsumer = {
  mainConsumerTag: string;
  broadcastConsumerTag: string;
  broadcastConsumerName: string;
  subject: string;
  consumerName: string;
};

export class NatsWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<M> {
  private readonly state: NatsSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedConsumers: Map<string, Array<OwnedConsumer>> = new Map();

  public constructor(options: NatsWorkerQueueOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishNatsMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
      },
      this.state,
      this.logger,
      { delayManager: this.delayManager },
    );
  }

  public async consume(
    queueOrOptions: string | ConsumeOptions<M> | Array<ConsumeOptions<M>>,
    callback?: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<void> {
    if (Array.isArray(queueOrOptions)) {
      for (const opt of queueOrOptions) {
        await this.consume(opt);
      }
      return;
    }

    const queue =
      typeof queueOrOptions === "string" ? queueOrOptions : queueOrOptions.queue;
    const cb = typeof queueOrOptions === "string" ? callback : queueOrOptions.callback;

    if (!cb) {
      throw new IrisDriverError("consume() requires a callback");
    }

    if (!this.state.js || !this.state.jsm) {
      throw new IrisDriverError("Cannot consume: connection is not available");
    }

    const subject = resolveSubject(this.state.prefix, queue);
    const consumerName = resolveConsumerName({
      prefix: this.state.prefix,
      topic: queue,
      queue,
      type: "worker",
    });

    const wrappedCallback = wrapNatsConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      cb,
      this.state,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );

    // Main consumer: shared durable consumer for competing-consumer pattern
    const mainLoop = await createNatsConsumer({
      js: this.state.js,
      jsm: this.state.jsm,
      streamName: this.state.streamName,
      consumerName,
      subject,
      prefetch: this.state.prefetch,
      onMessage: wrappedCallback,
      logger: this.logger,
      ensuredConsumers: this.state.ensuredConsumers,
      deliverPolicy: "all",
    });
    this.state.consumerLoops.push(mainLoop);
    this.state.consumerRegistrations.push({
      consumerTag: mainLoop.consumerTag,
      streamName: this.state.streamName,
      consumerName,
      subject,
      callback: wrappedCallback,
      deliverPolicy: "all",
    });

    // Broadcast consumer: unique ephemeral consumer on the broadcast subject
    // so every worker instance independently receives broadcast messages.
    const broadcastSubject = `${subject}.broadcast`;
    const broadcastConsumerName = `${consumerName}_bc_${randomUUID()}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );

    const broadcastLoop = await createNatsConsumer({
      js: this.state.js,
      jsm: this.state.jsm,
      streamName: this.state.streamName,
      consumerName: broadcastConsumerName,
      subject: broadcastSubject,
      prefetch: this.state.prefetch,
      onMessage: wrappedCallback,
      logger: this.logger,
      ensuredConsumers: this.state.ensuredConsumers,
      deliverPolicy: "new",
    });
    this.state.consumerLoops.push(broadcastLoop);
    this.state.consumerRegistrations.push({
      consumerTag: broadcastLoop.consumerTag,
      streamName: this.state.streamName,
      consumerName: broadcastConsumerName,
      subject: broadcastSubject,
      callback: wrappedCallback,
      deliverPolicy: "new",
    });

    const existing = this.ownedConsumers.get(queue) ?? [];
    existing.push({
      mainConsumerTag: mainLoop.consumerTag,
      broadcastConsumerTag: broadcastLoop.consumerTag,
      broadcastConsumerName,
      subject,
      consumerName,
    });
    this.ownedConsumers.set(queue, existing);

    // Wait until both consumers are ready before returning
    await Promise.all([mainLoop.ready, broadcastLoop.ready]);
  }

  public async unconsume(queue: string): Promise<void> {
    const consumers = this.ownedConsumers.get(queue);
    if (!consumers || consumers.length === 0) return;

    for (const consumer of consumers) {
      await stopNatsConsumer(this.state, consumer.mainConsumerTag);
      await stopNatsConsumer(this.state, consumer.broadcastConsumerTag);

      if (this.state.jsm) {
        try {
          await this.state.jsm.consumers.delete(
            this.state.streamName,
            consumer.broadcastConsumerName,
          );
        } catch {
          // ignore
        }
        this.state.ensuredConsumers.delete(consumer.broadcastConsumerName);
      }

      for (const tag of [consumer.mainConsumerTag, consumer.broadcastConsumerTag]) {
        const idx = this.state.consumerRegistrations.findIndex(
          (r) => r.consumerTag === tag,
        );
        if (idx !== -1) this.state.consumerRegistrations.splice(idx, 1);
      }
    }

    this.ownedConsumers.delete(queue);
  }

  public async unconsumeAll(): Promise<void> {
    for (const [, consumers] of this.ownedConsumers) {
      for (const consumer of consumers) {
        await stopNatsConsumer(this.state, consumer.mainConsumerTag);
        await stopNatsConsumer(this.state, consumer.broadcastConsumerTag);

        if (this.state.jsm) {
          try {
            await this.state.jsm.consumers.delete(
              this.state.streamName,
              consumer.broadcastConsumerName,
            );
          } catch {
            // ignore
          }
          this.state.ensuredConsumers.delete(consumer.broadcastConsumerName);
        }

        for (const tag of [consumer.mainConsumerTag, consumer.broadcastConsumerTag]) {
          const idx = this.state.consumerRegistrations.findIndex(
            (r) => r.consumerTag === tag,
          );
          if (idx !== -1) this.state.consumerRegistrations.splice(idx, 1);
        }
      }
    }

    this.ownedConsumers.clear();
  }
}
