import { randomUUID } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces";
import type { ConsumeEnvelope, ConsumeOptions, PublishOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { RedisSharedState } from "../types/redis-types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { DriverWorkerQueueBase } from "../../../classes/DriverWorkerQueueBase";
import { publishRedisMessages } from "../utils/publish-redis-messages";
import { wrapRedisConsumer } from "../utils/wrap-redis-consumer";
import { createConsumerLoop } from "../utils/create-consumer-loop";
import { resolveStreamKey } from "../utils/resolve-stream-key";
import { resolveGroupName } from "../utils/resolve-group-name";
import { stopConsumerLoop } from "../utils/stop-consumer-loop";

export type RedisWorkerQueueOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: RedisSharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

type OwnedConsumer = {
  mainConsumerTag: string;
  broadcastConsumerTag: string;
  streamKey: string;
  groupName: string;
};

export class RedisWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<M> {
  private readonly state: RedisSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedConsumers: Map<string, Array<OwnedConsumer>> = new Map();

  public constructor(options: RedisWorkerQueueOptions<M>) {
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

    if (!this.state.publishConnection) {
      throw new IrisDriverError("Cannot consume: connection is not available");
    }

    const streamKey = resolveStreamKey(this.state.prefix, queue);
    const groupName = resolveGroupName({
      prefix: this.state.prefix,
      topic: queue,
      queue,
      type: "worker",
    });

    const wrappedCallback = wrapRedisConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      cb,
      this.state,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager, delayManager: this.delayManager },
    );

    // Main consumer loop: shared group for competing-consumer (non-broadcast)
    const mainLoop = await createConsumerLoop({
      publishConnection: this.state.publishConnection,
      streamKey,
      groupName,
      consumerName: this.state.consumerName,
      blockMs: this.state.blockMs,
      count: this.state.prefetch,
      onEntry: wrappedCallback,
      logger: this.logger,
      createdGroups: this.state.createdGroups,
      startId: "0",
    });
    this.state.consumerLoops.push(mainLoop);
    this.state.consumerRegistrations.push({
      consumerTag: mainLoop.consumerTag,
      streamKey,
      groupName,
      consumerName: this.state.consumerName,
      callback: wrappedCallback,
    });

    // Broadcast consumer loop: unique group per consumer on a separate broadcast
    // stream so every consumer independently receives every broadcast message.
    const broadcastStreamKey = `${streamKey}:broadcast`;
    const broadcastGroupName = `${groupName}.bc.${randomUUID()}`;

    const broadcastLoop = await createConsumerLoop({
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

    const existing = this.ownedConsumers.get(queue) ?? [];
    existing.push({
      mainConsumerTag: mainLoop.consumerTag,
      broadcastConsumerTag: broadcastLoop.consumerTag,
      streamKey,
      groupName,
    });
    this.ownedConsumers.set(queue, existing);

    // Wait until both loops are blocking for new messages before returning,
    // so callers can publish immediately after consume() resolves.
    await Promise.all([mainLoop.ready, broadcastLoop.ready]);
  }

  public async unconsume(queue: string): Promise<void> {
    const consumers = this.ownedConsumers.get(queue);
    if (!consumers || consumers.length === 0) return;

    for (const consumer of consumers) {
      await stopConsumerLoop(this.state, consumer.mainConsumerTag);
      await stopConsumerLoop(this.state, consumer.broadcastConsumerTag);

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
        await stopConsumerLoop(this.state, consumer.mainConsumerTag);
        await stopConsumerLoop(this.state, consumer.broadcastConsumerTag);

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
