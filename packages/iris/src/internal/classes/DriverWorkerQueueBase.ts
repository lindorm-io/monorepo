import { IrisDriverError } from "../../errors/IrisDriverError.js";
import type { IIrisWorkerQueue, IMessage } from "../../interfaces/index.js";
import type {
  ConsumeEnvelope,
  ConsumeOptions,
  IrisDriverType,
  PublishOptions,
} from "../../types/index.js";
import type { ConsumerCallbackHost } from "../utils/consume-message-core.js";
import { DriverBase } from "./DriverBase.js";
import type { DriverBaseSettings } from "./DriverBase.js";

export type DriverWorkerQueueBaseSettings<M extends IMessage> = DriverBaseSettings<M> & {
  driverType: IrisDriverType;
};

/**
 * Shared consume/unconsume lifecycle for every driver's worker queue.
 *
 * The lifecycle scaffolding is identical across all five drivers — the
 * `consume(name, cb)` vs `consume({...ConsumeOptions})` overload normalization,
 * array recursion, the callback-required guard, keying owned consumers by queue,
 * and the teardown loops — so it lives here as a template method. Each driver
 * supplies only the broker-specific work through two hooks:
 *
 * - `consumeOne` opens the actual consumer(s) for one queue (including any
 *   `@Broadcast` dual-consumer, competing-consumer group wiring, and consumer
 *   registration for reconnect) and returns a driver-defined handle `C`
 *   describing what was opened. The base records that handle under the queue key.
 * - `teardownConsumer` closes everything a `consumeOne` opened for a single
 *   handle (cancelling the consumer, releasing pooled/retry consumers, and
 *   removing the reconnect registration). The base calls it from both
 *   `unconsume` and `unconsumeAll`, so a driver only writes its teardown once.
 *
 * `C` is the driver's own owned-consumer shape (e.g. main + broadcast consumer
 * tags, group/topic identifiers); the base treats it opaquely.
 */
export abstract class DriverWorkerQueueBase<M extends IMessage, C = unknown>
  extends DriverBase<M>
  implements IIrisWorkerQueue<M>
{
  protected readonly ownedConsumers: Map<string, Array<C>> = new Map();

  protected constructor(options: DriverWorkerQueueBaseSettings<M>) {
    super(options, "WorkerQueue");
  }

  abstract publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;

  async consume(
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
      throw new IrisDriverError("consume() requires a callback", {
        code: "consume_callback_required",
        title: "Consume Callback Required",
        details:
          "consume() was called without a callback function to handle delivered messages.",
      });
    }

    const consumer = await this.consumeOne(queue, cb);

    const existing = this.ownedConsumers.get(queue) ?? [];
    existing.push(consumer);
    this.ownedConsumers.set(queue, existing);
  }

  async unconsume(queue: string): Promise<void> {
    const consumers = this.ownedConsumers.get(queue);
    if (!consumers || consumers.length === 0) return;

    for (const consumer of consumers) {
      await this.teardownConsumer(consumer);
    }

    this.ownedConsumers.delete(queue);
  }

  async unconsumeAll(): Promise<void> {
    for (const [, consumers] of this.ownedConsumers) {
      for (const consumer of consumers) {
        await this.teardownConsumer(consumer);
      }
    }

    this.ownedConsumers.clear();
  }

  /**
   * The consume-side host callbacks every driver's consumer wrapper needs. The
   * literal is identical across drivers, so it is shared here.
   */
  protected consumerHooks(): ConsumerCallbackHost<M> {
    return {
      prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
      afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
      onConsumeError: (err, msg) => this.onConsumeError(err, msg),
    };
  }

  /**
   * Open the broker-specific consumer(s) for a single queue and return a
   * driver-defined handle describing what was opened. Called once per normalized
   * consume request; the base records the returned handle under the queue key.
   */
  protected abstract consumeOne(
    queue: string,
    callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<C>;

  /**
   * Close everything `consumeOne` opened for one handle. Called from both
   * `unconsume` and `unconsumeAll`.
   */
  protected abstract teardownConsumer(consumer: C): Promise<void>;
}
