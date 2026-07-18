import { lindormId } from "@lindorm/random";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope, PublishOptions } from "../../../../types/index.js";
import {
  DriverWorkerQueueBase,
  type DriverWorkerQueueBaseOptions,
} from "../../../classes/DriverWorkerQueueBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import { resolveConsumeTopic } from "../../../message/utils/resolve-consume-topic.js";
import type { NatsSharedState } from "../types/nats-types.js";
import { createNatsConsumer } from "../utils/create-nats-consumer.js";
import { publishNatsMessages } from "../utils/publish-nats-messages.js";
import { resolveConsumerName } from "../utils/resolve-consumer-name.js";
import { resolveMaxDeliver } from "../utils/resolve-max-deliver.js";
import { resolveSubject } from "../utils/resolve-subject.js";
import { stopNatsConsumer } from "../utils/stop-nats-consumer.js";
import { wrapNatsConsumer } from "../utils/wrap-nats-consumer.js";

export type NatsWorkerQueueOptions<M extends IMessage> =
  DriverWorkerQueueBaseOptions<M> & {
    state: NatsSharedState;
    delayManager?: DelayManager;
    deadLetterManager?: DeadLetterManager;
  };

type OwnedConsumer = {
  mainConsumerTag: string;
  broadcastConsumerTag?: string;
  broadcastConsumerName?: string;
  subject: string;
  consumerName: string;
};

export class NatsWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<
  M,
  OwnedConsumer
> {
  private readonly state: NatsSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;

  constructor(options: NatsWorkerQueueOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishNatsMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
        warnPriorityUnsupportedOnce: (priority) =>
          this.warnPriorityUnsupportedOnce(priority),
      },
      this.state,
      this.logger,
      { delayManager: this.delayManager },
    );
  }

  protected async consumeOne(
    queue: string,
    cb: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<OwnedConsumer> {
    if (!this.state.js || !this.state.jsm) {
      throw new IrisDriverError("Cannot consume: connection is not available", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The NATS JetStream connection is not established, so the worker queue cannot start consuming.",
        data: { driver: "nats" },
      });
    }

    const listenTopic = resolveConsumeTopic(this.metadata, this.logger, queue);
    const subject = resolveSubject(this.state.prefix, listenTopic);
    const consumerName = resolveConsumerName({
      prefix: this.state.prefix,
      topic: listenTopic,
      queue,
      type: "worker",
    });

    const wrappedCallback = wrapNatsConsumer(
      this.consumerHooks(),
      cb,
      this.state,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );

    const maxDeliver = resolveMaxDeliver(this.metadata);

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
      maxDeliver,
    });
    this.state.consumerLoops.push(mainLoop);
    this.state.consumerRegistrations.push({
      consumerTag: mainLoop.consumerTag,
      streamName: this.state.streamName,
      consumerName,
      subject,
      callback: wrappedCallback,
      deliverPolicy: "all",
      maxDeliver,
    });

    // Broadcast consumer: only for broadcast message types. A unique ephemeral
    // consumer on the broadcast subject lets every worker instance receive every
    // broadcast message. For non-broadcast types nothing is ever published to the
    // broadcast subject, so the second consumer would be dead overhead.
    let broadcastLoop: Awaited<ReturnType<typeof createNatsConsumer>> | undefined;
    let broadcastConsumerName: string | undefined;
    if (this.metadata.broadcast) {
      const broadcastSubject = `${subject}.broadcast`;
      broadcastConsumerName = `${consumerName}_bc_${lindormId({ length: 16 })}`.replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );

      broadcastLoop = await createNatsConsumer({
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
        maxDeliver,
      });
      this.state.consumerLoops.push(broadcastLoop);
      this.state.consumerRegistrations.push({
        consumerTag: broadcastLoop.consumerTag,
        streamName: this.state.streamName,
        consumerName: broadcastConsumerName,
        subject: broadcastSubject,
        callback: wrappedCallback,
        deliverPolicy: "new",
        maxDeliver,
      });
    }

    // Wait until the consumers are ready before returning
    const ready = [mainLoop.ready];
    if (broadcastLoop) ready.push(broadcastLoop.ready);
    await Promise.all(ready);

    return {
      mainConsumerTag: mainLoop.consumerTag,
      broadcastConsumerTag: broadcastLoop?.consumerTag,
      broadcastConsumerName,
      subject,
      consumerName,
    };
  }

  protected async teardownConsumer(consumer: OwnedConsumer): Promise<void> {
    const tags = [consumer.mainConsumerTag, consumer.broadcastConsumerTag].filter(
      (t): t is string => Boolean(t),
    );
    for (const tag of tags) {
      await stopNatsConsumer(this.state, tag);
    }

    if (this.state.jsm && consumer.broadcastConsumerName) {
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

    for (const tag of tags) {
      const idx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === tag,
      );
      if (idx !== -1) this.state.consumerRegistrations.splice(idx, 1);
    }
  }
}
