import type { IMessage } from "../../interfaces/index.js";
import {
  DriverRpcClientBase,
  type DriverRpcClientBaseOptions,
} from "./DriverRpcClientBase.js";

/**
 * RPC clients whose transport has no native request/reply — redis (streams) and
 * kafka (topics) — share ONE reply consumer per client, created lazily on the
 * first `request()` and torn down on `close()`. This base owns that memoization
 * (byte-identical between the two drivers) and delegates the transport-specific
 * subscription setup to {@link createReplyConsumer}.
 *
 * Drivers with native request/reply (nats — `nc.request`) or an in-process
 * handler map (memory), and rabbit — whose `amq.rabbitmq.reply-to` pseudo-queue
 * allows only ONE consumer per channel and so needs channel-swap detection —
 * extend {@link DriverRpcClientBase} directly instead.
 */
export abstract class SharedReplyConsumerRpcClientBase<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcClientBase<Req, Res> {
  private replyConsumerPromise: Promise<void> | null = null;

  protected constructor(
    options: DriverRpcClientBaseOptions<Req, Res>,
    loggerLabel: string,
  ) {
    super(options, loggerLabel);
  }

  /**
   * Lazily create the shared reply consumer, memoizing the setup so concurrent
   * `request()` calls share ONE consumer. A failed setup is not cached, so a
   * later request retries it.
   */
  protected async ensureReplyConsumer(): Promise<void> {
    this.replyConsumerPromise ??= this.createReplyConsumer().catch((err) => {
      this.replyConsumerPromise = null;
      throw err;
    });
    await this.replyConsumerPromise;
  }

  /** Drop the memoized reply consumer so the next `request()` re-creates it. */
  protected resetReplyConsumer(): void {
    this.replyConsumerPromise = null;
  }

  /**
   * Open the broker-specific reply subscription/topic and wire each reply to
   * {@link DriverRpcClientBase.handleReplyPayload}. Called at most once per
   * client (memoized by {@link ensureReplyConsumer}).
   */
  protected abstract createReplyConsumer(): Promise<void>;
}
