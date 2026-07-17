import type { IAmphora } from "@lindorm/amphora";
import type { Constructor } from "@lindorm/types";
import type {
  IIrisMessageBus,
  IIrisPublisher,
  IIrisRpcClient,
  IIrisRpcServer,
  IIrisStreamProcessor,
  IIrisWorkerQueue,
  IMessage,
} from "../../../interfaces/index.js";
import type { DeadLetterEntry } from "../../../types/dead-letter.js";

export type TckCapabilities = {
  // ─── Always-on (tested unconditionally) ──────────────────────────────────────
  // publish/subscribe, fan-out, topic resolution, hooks

  // ─── Gated capabilities ──────────────────────────────────────────────────────

  /** Competing-consumer worker queue */
  workerQueue: boolean;
  /** RPC request/response */
  rpc: boolean;
  /**
   * The RPC client detects an unroutable request — no server registered for the
   * topic — and rejects immediately with a typed `rpc_handler_not_found`,
   * rather than hanging until the request timeout. memory/nats/rabbit can cheaply
   * observe the missing destination (in-process lookup, NATS NO_RESPONDERS, the
   * AMQP mandatory-return); Kafka and Redis Streams have no cheap
   * unroutable-destination signal, so an unhandled request there rejects only
   * when the timeout elapses (IrisTimeoutError).
   */
  rpcFastFail: boolean;
  /** Stream processor/pipeline */
  stream: boolean;
  /** Delayed publish */
  delay: boolean;
  /** Retry with backoff */
  retry: boolean;
  /**
   * Retry policy is producer-authoritative: `maxRetries` travels on the wire and
   * bounds redelivery on the consumer even when the consumer's own `@Retry`
   * decorator declares a different value (the rolling-deploy skew scenario).
   *
   * True for drivers whose redelivery mechanism reconstructs the retry budget
   * from the wire on every attempt — memory (in-process), Kafka/Redis/Rabbit (each
   * re-publishes an envelope carrying the incremented wire `attempt`). For those,
   * the consumer's local `@Retry` cannot override the producer's count.
   *
   * False for NATS JetStream: redelivery is server-driven (`msg.nak` → the server
   * redelivers), bounded by the durable consumer's `max_deliver`. That ceiling is
   * a consumer-side property fixed at SUBSCRIBE time from the consumer's local
   * `@Retry`, before any producer's per-message wire policy is known — so the
   * delivery ceiling is consumer-authoritative and a higher producer `maxRetries`
   * cannot raise it. See `resolveMaxDeliver`.
   */
  retryProducerAuthoritative: boolean;
  /**
   * A retry reaches ONLY the consumer that failed — never the other consumers
   * that already succeeded. On a fan-out type (N independent bus subscribers, or
   * N broadcast worker consumers) a single handler failure must redeliver to that
   * one failing consumer alone; every other consumer sees the message exactly
   * once, with no spurious duplicate.
   *
   * True for drivers whose redelivery targets the failing consumer's own
   * mailbox: memory (re-invokes the same bound callback closure), NATS JetStream
   * (server redelivers to the same durable consumer), and Rabbit (retry
   * dead-letters via the default exchange keyed by the failing queue's own name).
   *
   * False for Kafka and Redis Streams today: their retry re-publishes to the
   * shared topic/stream, so every consumer group re-consumes it — a fan-out
   * blast-radius. Their targeted-retry slices flip this true.
   */
  retryConsumerTargeted: boolean;
  /** Dead letter queue */
  deadLetter: boolean;
  /** Broadcast to all consumers */
  broadcast: boolean;
  /** Encryption via @Encrypted + Amphora */
  encryption: boolean;
  /** Compression via @Compressed */
  compression: boolean;

  // ─── Delivery-guarantee capabilities ─────────────────────────────────────────

  /**
   * Delivery order equals publish order across a single consumer.
   * Memory dispatches synchronously in publish order; real brokers (Kafka
   * partitions, consumer-group rebalancing, Rabbit prefetch) do not guarantee
   * global ordering across a consumer.
   */
  strictOrdering: boolean;
  /**
   * Competing consumers on a queue receive exactly-even counts.
   * Memory uses a deterministic round-robin; real brokers distribute by
   * prefetch / partition assignment, so counts may be uneven.
   */
  evenDistribution: boolean;
  /**
   * No redelivery or duplication — a successfully handled message is delivered
   * exactly once (attempt stays 0 on success). Real brokers offer at-least-once
   * delivery and may redeliver on rebalancing or ack timing.
   */
  exactlyOnce: boolean;
  /**
   * Higher-priority messages are delivered before lower-priority messages that
   * are already waiting in the queue. Only brokers with native priority-queue
   * support honor @Priority / the `priority` publish option (currently RabbitMQ
   * via `x-max-priority`). Memory/Kafka/NATS/Redis treat priority as advisory
   * metadata only and deliver in publish order.
   */
  priority: boolean;
};

export type TckDriverHandle = {
  /**
   * The exact Amphora instance the source encrypts through — exposed so the
   * encryption suite can prove which KEK actually sealed a payload (the sealed
   * `kid` equals the id of the key the source's `find` selects). Same object the
   * pipeline uses, so a spy on it observes the real selection.
   */
  amphora: IAmphora;
  messageBus<M extends IMessage>(target: Constructor<M>): IIrisMessageBus<M>;
  publisher<M extends IMessage>(target: Constructor<M>): IIrisPublisher<M>;
  workerQueue<M extends IMessage>(target: Constructor<M>): IIrisWorkerQueue<M>;
  stream(): IIrisStreamProcessor;
  rpcClient<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcClient<Req, Res>;
  rpcServer<Req extends IMessage, Res extends IMessage>(
    requestTarget: Constructor<Req>,
    responseTarget: Constructor<Res>,
  ): IIrisRpcServer<Req, Res>;
  getDeadLetters(topic?: string): Promise<Array<DeadLetterEntry>>;
  purgeDeadLetters(topic?: string): Promise<number>;
  clear(): Promise<void>;
  teardown(): Promise<void>;
  /**
   * Force a real broker reconnect (drop + restore the transport) and resolve
   * once the driver has reconnected and re-established its consumers. Optional:
   * only drivers that can deterministically force a reconnect implement it; the
   * reconnect suite skips itself when it is absent.
   */
  forceReconnect?(): Promise<void>;
};

export type TckDriverFactory = {
  driver: string;
  capabilities: TckCapabilities;
  /** Max time in ms to wait for message delivery via waitFor(). Default: 10000. */
  timeoutMs?: number;
  setup(messages: Array<Constructor<IMessage>>): Promise<TckDriverHandle>;
};
