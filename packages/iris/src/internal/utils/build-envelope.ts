import type { MessageMetadata } from "../message/types/metadata";
import type { OutboundPayload } from "../message/utils/prepare-outbound";
import type { EnvelopeOverrides } from "../types/envelope-overrides";
import type { IrisEnvelope } from "../types/iris-envelope";

export type { EnvelopeOverrides };

export const buildEnvelope = (
  outbound: OutboundPayload,
  topic: string,
  metadata: MessageMetadata,
  overrides?: EnvelopeOverrides,
): IrisEnvelope => {
  return {
    payload: outbound.payload,
    headers: outbound.headers,
    topic,
    priority: overrides?.priority ?? metadata.priority ?? 0,
    timestamp: Date.now(),
    expiry: overrides?.expiry ?? metadata.expiry ?? null,
    broadcast: metadata.broadcast,
    attempt: 0,
    maxRetries: metadata.retry?.maxRetries ?? 0,
    retryStrategy: metadata.retry?.strategy ?? "constant",
    retryDelay: metadata.retry?.delay ?? 1000,
    retryDelayMax: metadata.retry?.delayMax ?? 30000,
    retryMultiplier: metadata.retry?.multiplier ?? 2,
    retryJitter: metadata.retry?.jitter ?? false,
    replyTo: null,
    correlationId: null,
    identifierValue: overrides?.identifierValue ?? null,
  };
};
