import type { IrisCapabilities } from "../../../types/index.js";

/**
 * RabbitMQ honours every runtime capability: native TTL+DLX delay/retry/dead
 * letter, RPC with mandatory-return fast-fail, producer-authoritative retry,
 * per-queue targeted redelivery, and native `x-max-priority` ordering — the only
 * driver that reorders delivery by message priority.
 */
export const RABBIT_CAPABILITIES: IrisCapabilities = {
  workerQueue: true,
  rpc: true,
  rpcFastFail: true,
  stream: true,
  streamReplay: false,
  streamDurableOffset: false,
  delay: true,
  retry: true,
  retryProducerAuthoritative: true,
  retryConsumerTargeted: true,
  deadLetter: true,
  broadcast: true,
  encryption: true,
  compression: true,
  priority: true,
};
