import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";

export type PublishMessagesOptions = {
  delayManager?: DelayManager;
};

export type WrapConsumerCallbackOptions = {
  deadLetterManager?: DeadLetterManager;
};

export type MemoryEnvelope = IrisEnvelope;

export type MemorySubscription = {
  topic: string;
  queue: string | null;
  callback: (envelope: MemoryEnvelope) => Promise<void>;
  consumerTag: string;
};

export type MemoryConsumer = {
  topic: string;
  callback: (envelope: MemoryEnvelope) => Promise<void>;
  consumerTag: string;
};

export type MemoryRpcHandler = {
  queue: string;
  handler: (envelope: MemoryEnvelope) => Promise<MemoryEnvelope>;
};

export type MemorySharedState = {
  subscriptions: Array<MemorySubscription>;
  consumers: Array<MemoryConsumer>;
  rpcHandlers: Array<MemoryRpcHandler>;
  replyCallbacks: Map<string, (envelope: MemoryEnvelope) => void | Promise<void>>;
  pendingRejects: Map<string, (reason: Error) => void>;
  roundRobinIndexes: Map<string, number>;
  timers: Set<ReturnType<typeof setTimeout>>;
  inFlightCount: number;
  paused: boolean;
};
