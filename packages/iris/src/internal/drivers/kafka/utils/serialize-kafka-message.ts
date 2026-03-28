import type { IrisEnvelope } from "../../../types/iris-envelope";
import type { KafkaMessage } from "../types/kafka-types";

export const serializeKafkaMessage = (envelope: IrisEnvelope): KafkaMessage => {
  const headers: Record<string, string> = {
    "x-iris-headers": JSON.stringify(envelope.headers),
    "x-iris-topic": envelope.topic,
    "x-iris-priority": String(envelope.priority),
    "x-iris-timestamp": String(envelope.timestamp),
    "x-iris-broadcast": String(envelope.broadcast),
    "x-iris-attempt": String(envelope.attempt),
    "x-iris-max-retries": String(envelope.maxRetries),
    "x-iris-retry-strategy": envelope.retryStrategy,
    "x-iris-retry-delay": String(envelope.retryDelay),
    "x-iris-retry-delay-max": String(envelope.retryDelayMax),
    "x-iris-retry-multiplier": String(envelope.retryMultiplier),
    "x-iris-retry-jitter": String(envelope.retryJitter),
    "x-iris-expiry": envelope.expiry != null ? String(envelope.expiry) : "",
    "x-iris-reply-to": envelope.replyTo ?? "",
    "x-iris-correlation-id": envelope.correlationId ?? "",
  };

  return {
    key: envelope.identifierValue ?? null,
    value: envelope.payload,
    headers,
  };
};
