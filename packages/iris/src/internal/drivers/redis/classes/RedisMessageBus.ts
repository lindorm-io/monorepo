import { randomUUID } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces";
import type { PublishOptions, SubscribeOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { RedisSharedState } from "../types/redis-types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { DriverMessageBusBase } from "../../../classes/DriverMessageBusBase";
import { publishRedisMessages } from "../utils/publish-redis-messages";
import { wrapRedisConsumer } from "../utils/wrap-redis-consumer";
import { createConsumerLoop } from "../utils/create-consumer-loop";
import { resolveStreamKey } from "../utils/resolve-stream-key";
import { resolveGroupName } from "../utils/resolve-group-name";
import { stopConsumerLoop } from "../utils/stop-consumer-loop";

export type RedisMessageBusOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: RedisSharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

type OwnedSubscription = {
  consumerTag: string;
  streamKey: string;
  groupName: string;
};

export class RedisMessageBus<M extends IMessage> extends DriverMessageBusBase<M> {
  private readonly state: RedisSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedSubscriptions: Map<string, OwnedSubscription> = new Map();
  private readonly ephemeralTags: Set<string> = new Set();

  public constructor(options: RedisMessageBusOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishRedisMessages(
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

    if (!this.state.publishConnection) {
      throw new IrisDriverError("Cannot subscribe: connection is not available");
    }

    const streamKey = resolveStreamKey(this.state.prefix, options.topic);
    let groupName: string;

    if (options.queue) {
      groupName = resolveGroupName({
        prefix: this.state.prefix,
        topic: options.topic,
        queue: options.queue,
        type: "subscribe",
      });
    } else {
      groupName = `${this.state.prefix}.sub.ephemeral.${randomUUID()}`;
    }

    const wrappedCallback = wrapRedisConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      options.callback,
      this.state,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager, delayManager: this.delayManager },
    );

    const loop = await createConsumerLoop({
      publishConnection: this.state.publishConnection,
      streamKey,
      groupName,
      consumerName: this.state.consumerName,
      blockMs: this.state.blockMs,
      count: this.state.prefetch,
      onEntry: wrappedCallback,
      logger: this.logger,
      createdGroups: this.state.createdGroups,
    });
    this.state.consumerLoops.push(loop);

    this.state.consumerRegistrations.push({
      consumerTag: loop.consumerTag,
      streamKey,
      groupName,
      consumerName: this.state.consumerName,
      callback: wrappedCallback,
    });

    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    this.ownedSubscriptions.set(tagKey, {
      consumerTag: loop.consumerTag,
      streamKey,
      groupName,
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

    await stopConsumerLoop(this.state, sub.consumerTag);

    const regIdx = this.state.consumerRegistrations.findIndex(
      (r) => r.consumerTag === sub.consumerTag,
    );
    if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

    if (this.ephemeralTags.has(tagKey) && this.state.publishConnection) {
      try {
        await this.state.publishConnection.xgroup(
          "DESTROY",
          sub.streamKey,
          sub.groupName,
        );
      } catch {
        // Group may already be destroyed
      }
      this.ephemeralTags.delete(tagKey);
    }

    this.ownedSubscriptions.delete(tagKey);
  }

  public async unsubscribeAll(): Promise<void> {
    for (const [tagKey, sub] of this.ownedSubscriptions) {
      await stopConsumerLoop(this.state, sub.consumerTag);

      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === sub.consumerTag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

      if (this.ephemeralTags.has(tagKey) && this.state.publishConnection) {
        try {
          await this.state.publishConnection.xgroup(
            "DESTROY",
            sub.streamKey,
            sub.groupName,
          );
        } catch {
          // Group may already be destroyed
        }
      }
    }

    this.ephemeralTags.clear();
    this.ownedSubscriptions.clear();
  }
}
