import type { IrisCapabilities } from "../../../types/index.js";

/**
 * Redis Streams honours every runtime capability EXCEPT RPC fast-fail: it has no
 * cheap unroutable-destination signal, so an unhandled RPC request rejects only
 * when the timeout elapses. Retry is producer-authoritative and — via PEL-retain
 * plus native delivery-count retries — targeted to the failing consumer group.
 * Redis Streams have no priority-queue primitive, so `priority` is a no-op:
 * entries are delivered in stream (publish) order regardless.
 */
export const REDIS_CAPABILITIES: IrisCapabilities = {
  workerQueue: true,
  rpc: true,
  rpcFastFail: false,
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
  priority: false,
};
