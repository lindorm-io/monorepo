import { lindormId } from "@lindorm/random";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions, SubscribeOptions } from "../../../../types/index.js";
import {
  DriverMessageBusBase,
  type DriverMessageBusBaseOptions,
} from "../../../classes/DriverMessageBusBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import { resolveBroadcastDestination } from "../../../utils/resolve-broadcast-destination.js";
import type { NatsConsumerLoop, NatsSharedState } from "../types/nats-types.js";
import { createNatsConsumer } from "../utils/create-nats-consumer.js";
import { publishNatsMessages } from "../utils/publish-nats-messages.js";
import { resolveConsumerName } from "../utils/resolve-consumer-name.js";
import { resolveMaxDeliver } from "../utils/resolve-max-deliver.js";
import { resolveSubject } from "../utils/resolve-subject.js";
import { stopNatsConsumer } from "../utils/stop-nats-consumer.js";
import { wrapNatsConsumer } from "../utils/wrap-nats-consumer.js";

export type NatsMessageBusOptions<M extends IMessage> = DriverMessageBusBaseOptions<M> & {
  state: NatsSharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

type OwnedConsumer = {
  consumerTag: string;
  subject: string;
  consumerName: string;
};

type OwnedSubscription = OwnedConsumer & {
  /**
   * True for a no-queue (ephemeral) subscription: teardown must delete the
   * server-side consumer, which a durable queue subscription must not.
   */
  ephemeral: boolean;
  /**
   * Present only for @Broadcast message types: a second consumer on the
   * `${subject}.broadcast` subject with its own unique ephemeral consumer, so
   * this subscriber receives every broadcast independently (published messages
   * for a broadcast type route to the `.broadcast` subject, which the base
   * consumer never sees). Always ephemeral — cleaned up unconditionally.
   */
  broadcast?: OwnedConsumer;
};

export class NatsMessageBus<M extends IMessage> extends DriverMessageBusBase<
  M,
  OwnedSubscription
> {
  private readonly state: NatsSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;

  constructor(options: NatsMessageBusOptions<M>) {
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

  protected async subscribeOne(options: SubscribeOptions<M>): Promise<OwnedSubscription> {
    if (!this.state.js || !this.state.jsm) {
      throw new IrisDriverError("Cannot subscribe: connection is not available", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The NATS JetStream connection is not established, so the message bus cannot subscribe.",
        data: { driver: "nats" },
      });
    }

    const subject = resolveSubject(this.state.prefix, options.topic);
    let consumerName: string;

    if (options.queue) {
      consumerName = resolveConsumerName({
        prefix: this.state.prefix,
        topic: options.topic,
        queue: options.queue,
        type: "subscribe",
      });
    } else {
      consumerName =
        `${this.state.prefix}_sub_ephemeral_${lindormId({ length: 16 })}`.replace(
          /[^a-zA-Z0-9_-]/g,
          "_",
        );
    }

    const wrappedCallback = wrapNatsConsumer(
      this.consumerHooks(),
      options.callback,
      this.state,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );

    const maxDeliver = resolveMaxDeliver(this.metadata);

    const loop = await createNatsConsumer({
      js: this.state.js,
      jsm: this.state.jsm,
      streamName: this.state.streamName,
      consumerName,
      subject,
      prefetch: this.state.prefetch,
      onMessage: wrappedCallback,
      logger: this.logger,
      ensuredConsumers: this.state.ensuredConsumers,
      deliverPolicy: "new",
      maxDeliver,
    });
    this.state.consumerLoops.push(loop);

    this.state.consumerRegistrations.push({
      consumerTag: loop.consumerTag,
      streamName: this.state.streamName,
      consumerName,
      subject,
      callback: wrappedCallback,
      deliverPolicy: "new",
      maxDeliver,
    });

    const owned: OwnedSubscription = {
      consumerTag: loop.consumerTag,
      subject,
      consumerName,
      ephemeral: !options.queue,
    };

    // For @Broadcast message types, publish routes every message to the
    // `${subject}.broadcast` subject. The base consumer above never sees those,
    // so open a second consumer on the broadcast subject with its own unique
    // ephemeral consumer, guaranteeing this subscriber receives every broadcast
    // independently of any other (never competing on a shared consumer).
    let broadcastLoop: NatsConsumerLoop | undefined;

    if (this.metadata.broadcast) {
      const broadcastSubject = resolveBroadcastDestination(subject, true, ".");
      const broadcastConsumerName =
        `${this.state.prefix}_bc_ephemeral_${lindormId({ length: 16 })}`.replace(
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

      owned.broadcast = {
        consumerTag: broadcastLoop.consumerTag,
        subject: broadcastSubject,
        consumerName: broadcastConsumerName,
      };
    }

    await loop.ready;
    // Await the broadcast fetch loop too so a publish immediately after
    // subscribe is seen by this consumer.
    if (broadcastLoop) await broadcastLoop.ready;

    return owned;
  }

  protected async teardownSubscription(sub: OwnedSubscription): Promise<void> {
    await stopNatsConsumer(this.state, sub.consumerTag);

    const regIdx = this.state.consumerRegistrations.findIndex(
      (r) => r.consumerTag === sub.consumerTag,
    );
    if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

    if (sub.ephemeral) {
      await this.deleteEphemeralConsumer(sub.consumerName);
    }

    if (sub.broadcast) await this.teardownBroadcast(sub.broadcast);
  }

  /**
   * Tear down a @Broadcast subscriber's dedicated consumer: stop its loop, drop
   * its registration, and delete the always-ephemeral server-side consumer.
   */
  private async teardownBroadcast(bc: OwnedConsumer): Promise<void> {
    await stopNatsConsumer(this.state, bc.consumerTag);

    const regIdx = this.state.consumerRegistrations.findIndex(
      (r) => r.consumerTag === bc.consumerTag,
    );
    if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

    await this.deleteEphemeralConsumer(bc.consumerName);
  }

  private async deleteEphemeralConsumer(consumerName: string): Promise<void> {
    if (this.state.jsm) {
      try {
        await this.state.jsm.consumers.delete(this.state.streamName, consumerName);
      } catch {
        // ignore — consumer may already be gone
      }
    }
    this.state.ensuredConsumers.delete(consumerName);
  }
}
