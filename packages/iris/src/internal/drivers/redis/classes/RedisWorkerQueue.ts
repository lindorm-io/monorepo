import { lindormId } from "@lindorm/random";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope, PublishOptions } from "../../../../types/index.js";
import {
  DriverWorkerQueueBase,
  type DriverWorkerQueueBaseSettings,
} from "../../../classes/DriverWorkerQueueBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import { resolveConsumeTopic } from "../../../message/utils/resolve-consume-topic.js";
import type { RedisSharedState } from "../types/redis-types.js";
import { createConsumerLoop } from "../utils/create-consumer-loop.js";
import { publishRedisMessages } from "../utils/publish-redis-messages.js";
import { resolveGroupName } from "../utils/resolve-group-name.js";
import { resolveStreamKey } from "../utils/resolve-stream-key.js";
import { stopConsumerLoop } from "../utils/stop-consumer-loop.js";
import { wrapRedisConsumer } from "../utils/wrap-redis-consumer.js";

export type RedisWorkerQueueSettings<M extends IMessage> =
  DriverWorkerQueueBaseSettings<M> & {
    state: RedisSharedState;
    delayManager?: DelayManager;
    deadLetterManager?: DeadLetterManager;
  };

type OwnedConsumer = {
  mainConsumerTag: string;
  broadcastConsumerTag?: string;
  streamKey: string;
  groupName: string;
};

export class RedisWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<
  M,
  OwnedConsumer
> {
  private readonly state: RedisSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;

  constructor(options: RedisWorkerQueueSettings<M>) {
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
    if (!this.state.publishConnection) {
      throw new IrisDriverError("Cannot consume: connection is not available", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The Redis publish connection is not established, so the worker queue cannot start consuming.",
        data: { driver: "redis" },
      });
    }

    const listenTopic = resolveConsumeTopic(this.metadata, this.logger, queue);
    const streamKey = resolveStreamKey(this.state.prefix, listenTopic);
    const groupName = resolveGroupName({
      prefix: this.state.prefix,
      topic: listenTopic,
      queue,
      type: "worker",
    });

    const wrappedCallback = wrapRedisConsumer(
      this.consumerHooks(),
      cb,
      this.state,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
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

    // Broadcast consumer loop: only for broadcast message types. A unique group
    // per consumer on a separate broadcast stream lets every consumer receive
    // every broadcast message. For non-broadcast types nothing is ever published
    // to the broadcast stream, so the second loop would be dead overhead.
    let broadcastLoop: Awaited<ReturnType<typeof createConsumerLoop>> | undefined;
    if (this.metadata.broadcast) {
      const broadcastStreamKey = `${streamKey}:broadcast`;
      const broadcastGroupName = `${groupName}.bc.${lindormId({ length: 16 })}`;

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
    }

    // Wait until the loops are blocking for new messages before returning,
    // so callers can publish immediately after consume() resolves.
    const ready = [mainLoop.ready];
    if (broadcastLoop) ready.push(broadcastLoop.ready);
    await Promise.all(ready);

    return {
      mainConsumerTag: mainLoop.consumerTag,
      broadcastConsumerTag: broadcastLoop?.consumerTag,
      streamKey,
      groupName,
    };
  }

  protected async teardownConsumer(consumer: OwnedConsumer): Promise<void> {
    const tags = [consumer.mainConsumerTag, consumer.broadcastConsumerTag].filter(
      (t): t is string => Boolean(t),
    );
    for (const tag of tags) {
      await stopConsumerLoop(this.state, tag);

      const idx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === tag,
      );
      if (idx !== -1) this.state.consumerRegistrations.splice(idx, 1);
    }
  }
}
