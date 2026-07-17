import { randomId } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions, SubscribeOptions } from "../../../../types/index.js";
import type { DriverBaseOptions } from "../../../classes/DriverBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { RedisSharedState } from "../types/redis-types.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import { DriverMessageBusBase } from "../../../classes/DriverMessageBusBase.js";
import { resolveBroadcastDestination } from "../../../utils/resolve-broadcast-destination.js";
import { publishRedisMessages } from "../utils/publish-redis-messages.js";
import { wrapRedisConsumer } from "../utils/wrap-redis-consumer.js";
import { createConsumerLoop } from "../utils/create-consumer-loop.js";
import { resolveStreamKey } from "../utils/resolve-stream-key.js";
import { resolveGroupName } from "../utils/resolve-group-name.js";
import { stopConsumerLoop } from "../utils/stop-consumer-loop.js";

export type RedisMessageBusOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: RedisSharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

type OwnedConsumer = {
  consumerTag: string;
  streamKey: string;
  groupName: string;
};

type OwnedSubscription = OwnedConsumer & {
  /**
   * Present only for @Broadcast message types: a second consumer on the
   * `${streamKey}:broadcast` stream with its own unique group, so this
   * subscriber receives every broadcast independently (published messages for a
   * broadcast type route to the `:broadcast` stream, which the base group never
   * reads). Always a unique ephemeral group — cleaned up unconditionally.
   */
  broadcast?: OwnedConsumer;
};

export class RedisMessageBus<M extends IMessage> extends DriverMessageBusBase<M> {
  private readonly state: RedisSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedSubscriptions: Map<string, OwnedSubscription> = new Map();
  private readonly ephemeralTags: Set<string> = new Set();

  constructor(options: RedisMessageBusOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
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

  async subscribe(
    options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void> {
    if (Array.isArray(options)) {
      for (const opt of options) {
        await this.subscribe(opt);
      }
      return;
    }

    if (!this.state.publishConnection) {
      throw new IrisDriverError("Cannot subscribe: connection is not available", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The Redis publish connection is not established, so the message bus cannot subscribe.",
        data: { driver: "redis" },
      });
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
      groupName = `${this.state.prefix}.sub.ephemeral.${randomId({ length: 16 })}`;
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
      { deadLetterManager: this.deadLetterManager },
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

    const owned: OwnedSubscription = {
      consumerTag: loop.consumerTag,
      streamKey,
      groupName,
    };

    // For @Broadcast message types, publish routes every message to the
    // `${streamKey}:broadcast` stream. The base group above never reads those,
    // so open a second consumer on the broadcast stream with its own unique
    // group, guaranteeing this subscriber receives every broadcast independently
    // of any other (never competing on a shared group).
    let broadcastLoop: Awaited<ReturnType<typeof createConsumerLoop>> | undefined;

    if (this.metadata.broadcast) {
      const broadcastStreamKey = resolveBroadcastDestination(streamKey, true, ":");
      const broadcastGroupName = `${this.state.prefix}.bc.ephemeral.${randomId({ length: 16 })}`;

      broadcastLoop = await createConsumerLoop({
        publishConnection: this.state.publishConnection,
        streamKey: broadcastStreamKey,
        groupName: broadcastGroupName,
        consumerName: this.state.consumerName,
        blockMs: this.state.blockMs,
        count: this.state.prefetch,
        onEntry: wrappedCallback,
        logger: this.logger,
        createdGroups: this.state.createdGroups,
      });
      this.state.consumerLoops.push(broadcastLoop);

      this.state.consumerRegistrations.push({
        consumerTag: broadcastLoop.consumerTag,
        streamKey: broadcastStreamKey,
        groupName: broadcastGroupName,
        consumerName: this.state.consumerName,
        callback: wrappedCallback,
      });

      owned.broadcast = {
        consumerTag: broadcastLoop.consumerTag,
        streamKey: broadcastStreamKey,
        groupName: broadcastGroupName,
      };
    }

    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    this.ownedSubscriptions.set(tagKey, owned);

    if (!options.queue) {
      this.ephemeralTags.add(tagKey);
    }

    await loop.ready;
    // Await the broadcast loop too so a publish immediately after subscribe is
    // read by this consumer.
    if (broadcastLoop) await broadcastLoop.ready;
  }

  async unsubscribe(options: { topic: string; queue?: string }): Promise<void> {
    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    const sub = this.ownedSubscriptions.get(tagKey);

    if (!sub) return;

    await stopConsumerLoop(this.state, sub.consumerTag);

    const regIdx = this.state.consumerRegistrations.findIndex(
      (r) => r.consumerTag === sub.consumerTag,
    );
    if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

    if (this.ephemeralTags.has(tagKey)) {
      await this.destroyGroup(sub.streamKey, sub.groupName);
      this.ephemeralTags.delete(tagKey);
    }

    if (sub.broadcast) await this.teardownBroadcast(sub.broadcast);

    this.ownedSubscriptions.delete(tagKey);
  }

  async unsubscribeAll(): Promise<void> {
    for (const [tagKey, sub] of this.ownedSubscriptions) {
      await stopConsumerLoop(this.state, sub.consumerTag);

      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === sub.consumerTag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

      if (this.ephemeralTags.has(tagKey)) {
        await this.destroyGroup(sub.streamKey, sub.groupName);
      }

      if (sub.broadcast) await this.teardownBroadcast(sub.broadcast);
    }

    this.ephemeralTags.clear();
    this.ownedSubscriptions.clear();
  }

  /**
   * Tear down a @Broadcast subscriber's dedicated consumer: stop its loop, drop
   * its registration, and destroy its always-ephemeral group.
   */
  private async teardownBroadcast(bc: OwnedConsumer): Promise<void> {
    await stopConsumerLoop(this.state, bc.consumerTag);

    const regIdx = this.state.consumerRegistrations.findIndex(
      (r) => r.consumerTag === bc.consumerTag,
    );
    if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);

    await this.destroyGroup(bc.streamKey, bc.groupName);
  }

  private async destroyGroup(streamKey: string, groupName: string): Promise<void> {
    if (!this.state.publishConnection) return;
    try {
      await this.state.publishConnection.xgroup("DESTROY", streamKey, groupName);
    } catch {
      // Group may already be destroyed
    }
  }
}
