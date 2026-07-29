import type { IIrisMessageBus, IMessage } from "../../interfaces/index.js";
import type {
  IrisDriverType,
  PublishOptions,
  SubscribeOptions,
} from "../../types/index.js";
import type { ConsumerCallbackHost } from "../utils/consume-message-core.js";
import { DriverBase } from "./DriverBase.js";
import type { DriverBaseSettings } from "./DriverBase.js";

export type DriverMessageBusBaseSettings<M extends IMessage> = DriverBaseSettings<M> & {
  driverType: IrisDriverType;
};

/**
 * Shared subscribe/unsubscribe lifecycle for every driver's message bus.
 *
 * The lifecycle scaffolding is identical across all five drivers — array
 * normalization, keying owned subscriptions by `topic:queue`, and the teardown
 * loops — so it lives here as a template method. Each driver supplies only the
 * broker-specific work through two hooks:
 *
 * - `subscribeOne` opens the actual consumer(s) (including any `@Broadcast`
 *   dual-consumer) and returns a driver-defined handle `S` describing what was
 *   opened. The base records that handle under the `topic:queue` key.
 * - `teardownSubscription` closes everything a `subscribeOne` opened for a
 *   single handle. The base calls it from both `unsubscribe` and
 *   `unsubscribeAll`, so a driver only writes its teardown once.
 *
 * `S` is the driver's own owned-subscription shape (e.g. main + broadcast
 * consumer tags); the base treats it opaquely.
 */
export abstract class DriverMessageBusBase<M extends IMessage, S = unknown>
  extends DriverBase<M>
  implements IIrisMessageBus<M>
{
  protected readonly ownedSubscriptions: Map<string, S> = new Map();

  protected constructor(options: DriverMessageBusBaseSettings<M>) {
    super(options, "MessageBus");
  }

  abstract publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;

  async subscribe(
    options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void> {
    if (Array.isArray(options)) {
      for (const opt of options) {
        await this.subscribe(opt);
      }
      return;
    }

    const subscription = await this.subscribeOne(options);
    this.ownedSubscriptions.set(this.subscriptionKey(options), subscription);
  }

  async unsubscribe(options: { topic: string; queue?: string }): Promise<void> {
    const key = this.subscriptionKey(options);
    const subscription = this.ownedSubscriptions.get(key);

    if (!subscription) return;

    await this.teardownSubscription(subscription);
    this.ownedSubscriptions.delete(key);
  }

  async unsubscribeAll(): Promise<void> {
    for (const [, subscription] of this.ownedSubscriptions) {
      await this.teardownSubscription(subscription);
    }

    this.ownedSubscriptions.clear();
  }

  /**
   * Owned-subscription map key. A subscription is uniquely identified by its
   * topic and (optional) queue; a no-queue subscription keys on `topic:`.
   */
  protected subscriptionKey(options: { topic: string; queue?: string }): string {
    return `${options.topic}:${options.queue ?? ""}`;
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
   * Open the broker-specific consumer(s) for a single subscription and return a
   * driver-defined handle describing what was opened. Called once per
   * normalized subscription; the base records the returned handle.
   */
  protected abstract subscribeOne(options: SubscribeOptions<M>): Promise<S>;

  /**
   * Close everything `subscribeOne` opened for one handle. Called from both
   * `unsubscribe` and `unsubscribeAll`.
   */
  protected abstract teardownSubscription(subscription: S): Promise<void>;
}
