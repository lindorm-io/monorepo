import type { ILogger } from "@lindorm/logger";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";

export type WrapRedisConsumerOptions = {
  deadLetterManager?: DeadLetterManager;
  delayManager?: DelayManager;
};

export type CreateConsumerLoopOptions = {
  publishConnection: RedisClient;
  streamKey: string;
  groupName: string;
  consumerName: string;
  blockMs: number;
  count: number;
  onEntry: (entry: RedisStreamEntry) => Promise<void>;
  logger: ILogger;
  createdGroups?: Set<string>;
  /** Consumer group start offset. "$" = only new messages (pub/sub), "0" = from beginning (worker queue). Default: "$". */
  startId?: string;
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
  callback: (entry: RedisStreamEntry) => Promise<void>;
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
  callback: (entry: RedisStreamEntry) => Promise<void>;
};

export type RedisClient = {
  xadd: (...args: Array<string | number>) => Promise<string>;
  xreadgroup: (
    ...args: Array<string | number>
  ) => Promise<Array<[string, Array<[string, Array<string>]>]> | null>;
  xack: (stream: string, group: string, ...ids: Array<string>) => Promise<number>;
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
  } & import("../../../../types/index.js").RedisConnectionOptions;
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
