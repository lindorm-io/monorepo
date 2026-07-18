/**
 * Runtime capabilities of an Iris driver — the single source of truth for what
 * a driver actually supports. Each driver declares one honest `IrisCapabilities`
 * constant; the source surfaces it via `source.capabilities` so consumers can
 * query support, and the conformance suite (TCK) gates on it instead of a
 * hand-maintained duplicate that can silently drift.
 *
 * Every flag here describes GENUINE runtime behaviour a consumer (or a test)
 * would branch on. Pure test-observability knobs — whether a broker happens to
 * preserve strict ordering, distribute evenly, or deliver exactly once — are NOT
 * capabilities and stay in the TCK layer.
 */
export type IrisCapabilities = {
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
};
