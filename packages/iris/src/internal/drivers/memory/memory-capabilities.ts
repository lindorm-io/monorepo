import type { IrisCapabilities } from "../../../types/index.js";

/**
 * The in-memory driver honours every runtime capability in-process: worker
 * queues, RPC (fast-failing on an unroutable request), streams, delay/retry with
 * a producer-authoritative, consumer-targeted redelivery, dead letters,
 * broadcast, encryption and compression. It has NO priority queue — messages
 * dispatch synchronously in publish (FIFO) order, so `priority` is a no-op.
 */
export const MEMORY_CAPABILITIES: IrisCapabilities = {
  workerQueue: true,
  rpc: true,
  rpcFastFail: true,
  stream: true,
  delay: true,
  retry: true,
  retryProducerAuthoritative: true,
  retryConsumerTargeted: true,
  deadLetter: true,
  broadcast: true,
  encryption: true,
  compression: true,
  priority: false,
};
