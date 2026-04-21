import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { ParsedAmqpMessage } from "./parse-amqp-headers.js";

export const buildRabbitEnvelope = (
  parsed: ParsedAmqpMessage,
  metadata: MessageMetadata,
): IrisEnvelope => ({
  topic: parsed.envelope.topic ?? "",
  payload: parsed.payload,
  headers: parsed.headers,
  priority: parsed.envelope.priority ?? 0,
  timestamp: parsed.envelope.timestamp ?? Date.now(),
  expiry: parsed.envelope.expiry ?? metadata.expiry ?? null,
  broadcast: parsed.envelope.broadcast ?? metadata.broadcast,
  attempt: parsed.envelope.attempt ?? 0,
  maxRetries: metadata.retry?.maxRetries ?? 0,
  retryStrategy: metadata.retry?.strategy ?? "constant",
  retryDelay: metadata.retry?.delay ?? 1000,
  retryDelayMax: metadata.retry?.delayMax ?? 30000,
  retryMultiplier: metadata.retry?.multiplier ?? 2,
  retryJitter: metadata.retry?.jitter ?? false,
  replyTo: parsed.envelope.replyTo ?? null,
  correlationId: parsed.envelope.correlationId ?? null,
  identifierValue: null,
});
