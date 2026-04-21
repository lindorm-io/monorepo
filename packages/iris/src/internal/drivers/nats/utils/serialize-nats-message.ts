import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { NatsMsgHeaders, SerializedNatsMessage } from "../types/nats-types.js";

export type { SerializedNatsMessage };

export const serializeNatsMessage = (
  envelope: IrisEnvelope,
  _headersInit: () => NatsMsgHeaders,
): SerializedNatsMessage => {
  const json = JSON.stringify({
    payload: envelope.payload.toString("base64"),
    topic: envelope.topic,
    attempt: envelope.attempt,
    maxRetries: envelope.maxRetries,
    retryStrategy: envelope.retryStrategy,
    retryDelay: envelope.retryDelay,
    retryDelayMax: envelope.retryDelayMax,
    retryMultiplier: envelope.retryMultiplier,
    retryJitter: envelope.retryJitter,
    priority: envelope.priority,
    timestamp: envelope.timestamp,
    expiry: envelope.expiry,
    broadcast: envelope.broadcast,
    replyTo: envelope.replyTo,
    correlationId: envelope.correlationId,
    identifierValue: envelope.identifierValue,
    headers: envelope.headers,
  });

  return { data: new TextEncoder().encode(json) };
};
