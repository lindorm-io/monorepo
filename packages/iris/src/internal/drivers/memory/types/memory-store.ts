import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { IrisEnvelope } from "../../../types/iris-envelope";

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
