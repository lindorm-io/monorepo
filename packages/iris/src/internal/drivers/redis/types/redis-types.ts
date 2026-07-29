import type { ILogger } from "@lindorm/logger";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";

export type WrapRedisConsumerOptions = {
  deadLetterManager?: DeadLetterManager;
};

/**
 * What the consumer loop must do with a delivered stream entry after the
 * handler runs (M1, Option B — PEL-retain retries):
 *   - `"ack"`    → XACK the entry, removing it from the group's PEL (success,
 *                  dead-lettered, expired, exhausted, or poison).
 *   - `"retain"` → leave the entry in the FAILING group's PEL so ONLY that group
 *                  redelivers it (via the loop's delayed reclaim). This is how a
 *                  retry stays targeted to the consumer that failed instead of
 *                  fanning back out to every group on the shared stream.
 * A handler that returns `void` (RPC server, stream pipeline stages that don't
 * signal) is treated as `"ack"`.
 */
export type RedisConsumeOutcome = "ack" | "retain";

export type CreateConsumerLoopOptions = {
  publishConnection: RedisClient;
  streamKey: string;
  groupName: string;
  consumerName: string;
  blockMs: number;
  count: number;
  onEntry: (entry: RedisStreamEntry) => Promise<RedisConsumeOutcome | void>;
  logger: ILogger;
  createdGroups?: Set<string>;
  /** Consumer group start offset. "$" = only new messages (pub/sub), "0" = from beginning (worker queue). Default: "$". */
  startId?: string;
  /**
   * Reuse an existing consumer identity instead of minting a new one. Passed on
   * re-registration (post-reconnect) so the fresh loop adopts the dead loop's
   * consumer name and reclaims its orphaned PEL — messages delivered to the old
   * consumer but never ACKed (it died mid-flight) would otherwise be stranded,
   * since XREADGROUP ">" only ever returns never-delivered entries.
   */
  consumerTag?: string;
};

export type PublishRedisMessagesOptions = {
  delayManager?: DelayManager;
  /** Number of consumers in the queue — used to publish N copies for broadcast messages. */
  broadcastConsumerCount?: number;
};

export type GroupNameOptions = {
  prefix: string;
  topic: string;
  queue?: string;
  type: "subscribe" | "worker" | "rpc";
};

export type RedisStreamEntry = IrisEnvelope & {
  id: string;
};

export type RedisConsumerLoop = {
  consumerTag: string;
  groupName: string;
  streamKey: string;
  callback: (entry: RedisStreamEntry) => Promise<RedisConsumeOutcome | void>;
  abortController: AbortController;
  loopPromise: Promise<void>;
  connection: RedisClient;
  /** Resolves when the consumer has drained pending messages and is blocking for new ones. */
  ready: Promise<void>;
};

export type RedisConsumerRegistration = {
  consumerTag: string;
  streamKey: string;
  groupName: string;
  consumerName: string;
  callback: (entry: RedisStreamEntry) => Promise<RedisConsumeOutcome | void>;
};

export type RedisClient = {
  xadd: (...args: Array<string | number>) => Promise<string>;
  xreadgroup: (
    ...args: Array<string | number>
  ) => Promise<Array<[string, Array<[string, Array<string>]>]> | null>;
  xack: (stream: string, group: string, ...ids: Array<string>) => Promise<number>;
  /**
   * Extended-form XPENDING (`XPENDING key group [IDLE ms] start end count`),
   * one row per pending entry: `[id, consumerName, idleMs, deliveryCount]`.
   * `idleMs`/`deliveryCount` come back as integers (numbers) but are coerced
   * defensively, since some clients stringify them.
   */
  xpending: (
    ...args: Array<string | number>
  ) => Promise<Array<[string, string, string | number, string | number]>>;
  /** XCLAIM — transfers ownership of specific pending ids to this consumer, returning `[id, fields]` (or `[]` if none matched the min-idle gate). */
  xclaim: (...args: Array<string | number>) => Promise<Array<[string, Array<string>]>>;
  /** XRANGE — read an entry's fields without claiming it (used to inspect retry config before deciding to reclaim). */
  xrange: (...args: Array<string | number>) => Promise<Array<[string, Array<string>]>>;
  xgroup: (...args: Array<string>) => Promise<string>;
  del: (...keys: Array<string>) => Promise<number>;
  ping: () => Promise<string>;
  duplicate: (options?: Record<string, unknown>) => RedisClient;
  disconnect: () => Promise<void>;
  quit: () => Promise<string>;
  on: (event: string, listener: (...args: Array<unknown>) => void) => void;
};

export type RedisSharedState = {
  publishConnection: RedisClient | null;
  connectionConfig: {
    url?: string;
  } & import("../../../../types/index.js").RedisConnectionSettings;
  prefix: string;
  consumerName: string;
  consumerLoops: Array<RedisConsumerLoop>;
  consumerRegistrations: Array<RedisConsumerRegistration>;
  createdGroups: Set<string>;
  publishedStreams: Set<string>;
  inFlightCount: number;
  prefetch: number;
  blockMs: number;
  maxStreamLength: number | null;
};
