import type { IrisCapabilities } from "../../../types/index.js";

/**
 * RabbitMQ honours every runtime capability: native TTL+DLX delay/retry/dead
 * letter, RPC with mandatory-return fast-fail, producer-authoritative retry, and
 * per-queue targeted redelivery. (Native `x-max-priority` ordering is a separate
 * capability tracked outside this promoted set.)
 */
export const RABBIT_CAPABILITIES: IrisCapabilities = {
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
};
