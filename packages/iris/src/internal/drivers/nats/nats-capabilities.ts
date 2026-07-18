import type { IrisCapabilities } from "../../../types/index.js";

/**
 * NATS JetStream honours every runtime capability EXCEPT producer-authoritative
 * retry: redelivery is server-driven and bounded by the durable consumer's
 * `max_deliver`, a consumer-side ceiling fixed at subscribe time that a higher
 * producer `maxRetries` on the wire cannot raise (see `resolveMaxDeliver`).
 */
export const NATS_CAPABILITIES: IrisCapabilities = {
  workerQueue: true,
  rpc: true,
  rpcFastFail: true,
  stream: true,
  delay: true,
  retry: true,
  retryProducerAuthoritative: false,
  retryConsumerTargeted: true,
  deadLetter: true,
  broadcast: true,
  encryption: true,
  compression: true,
};
