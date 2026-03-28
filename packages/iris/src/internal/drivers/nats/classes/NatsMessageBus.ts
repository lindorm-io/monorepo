import { randomUUID } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces";
import type { PublishOptions, SubscribeOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { NatsSharedState } from "../types/nats-types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { DriverMessageBusBase } from "../../../classes/DriverMessageBusBase";
import { publishNatsMessages } from "../utils/publish-nats-messages";
import { wrapNatsConsumer } from "../utils/wrap-nats-consumer";
import { createNatsConsumer } from "../utils/create-nats-consumer";
import { resolveSubject } from "../utils/resolve-subject";
import { resolveConsumerName } from "../utils/resolve-consumer-name";
import { stopNatsConsumer } from "../utils/stop-nats-consumer";

export type NatsMessageBusOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: NatsSharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

type OwnedSubscription = {
  consumerTag: string;
  subject: string;
  consumerName: string;
};

export class NatsMessageBus<M extends IMessage> extends DriverMessageBusBase<M> {
  private readonly state: NatsSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedSubscriptions: Map<string, OwnedSubscription> = new Map();
  private readonly ephemeralTags: Set<string> = new Set();

  public constructor(options: NatsMessageBusOptions<M>) {
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

  public async subscribe(
    options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void> {
    if (Array.isArray(options)) {
      for (const opt of options) {
        await this.subscribe(opt);
      }
      return;
    }

    if (!this.state.js || !this.state.jsm) {
      throw new IrisDriverError("Cannot subscribe: connection is not available");
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
      consumerName = `${this.state.prefix}_sub_ephemeral_${randomUUID()}`.replace(
        /[^a-zA-Z0-9_-]/g,
        "_",
      );
    }

    const wrappedCallback = wrapNatsConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      options.callback,
      this.state,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );

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
    });
    this.state.consumerLoops.push(loop);

    this.state.consumerRegistrations.push({
      consumerTag: loop.consumerTag,
      streamName: this.state.streamName,
      consumerName,
      subject,
      callback: wrappedCallback,
      deliverPolicy: "new",
    });

    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    this.ownedSubscriptions.set(tagKey, {
      consumerTag: loop.consumerTag,
      subject,
      consumerName,
    });

    if (!options.queue) {
      this.ephemeralTags.add(tagKey);
    }

    await loop.ready;
  }

  public async unsubscribe(options: { topic: string; queue?: string }): Promise<void> {
    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    const sub = this.ownedSubscriptions.get(tagKey);

    if (!sub) return;

    await stopNatsConsumer(this.state, sub.consumerTag);

    const regIdx = this.state.consumerRegistrations.findIndex(
      (r) => r.consumerTag === sub.consumerTag,
    );
    if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

    if (this.ephemeralTags.has(tagKey)) {
      if (this.state.jsm) {
        try {
          await this.state.jsm.consumers.delete(this.state.streamName, sub.consumerName);
        } catch {
          // ignore
        }
      }
      this.state.ensuredConsumers.delete(sub.consumerName);
      this.ephemeralTags.delete(tagKey);
    }

    this.ownedSubscriptions.delete(tagKey);
  }

  public async unsubscribeAll(): Promise<void> {
    for (const [tagKey, sub] of this.ownedSubscriptions) {
      await stopNatsConsumer(this.state, sub.consumerTag);

      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === sub.consumerTag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

      if (this.ephemeralTags.has(tagKey)) {
        if (this.state.jsm) {
          try {
            await this.state.jsm.consumers.delete(
              this.state.streamName,
              sub.consumerName,
            );
          } catch {
            // ignore
          }
        }
        this.state.ensuredConsumers.delete(sub.consumerName);
      }
    }

    this.ephemeralTags.clear();
    this.ownedSubscriptions.clear();
  }
}
