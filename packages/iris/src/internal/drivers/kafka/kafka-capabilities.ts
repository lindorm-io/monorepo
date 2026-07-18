import type { IrisCapabilities } from "../../../types/index.js";

/**
 * Kafka honours every runtime capability EXCEPT RPC fast-fail: it has no cheap
 * unroutable-destination signal, so an unhandled RPC request rejects only when
 * the timeout elapses. Retry is producer-authoritative and — via per-group retry
 * topics — targeted to the failing consumer group.
 */
export const KAFKA_CAPABILITIES: IrisCapabilities = {
  workerQueue: true,
  rpc: true,
  rpcFastFail: false,
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
