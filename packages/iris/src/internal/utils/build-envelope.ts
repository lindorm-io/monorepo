import type { MessageMetadata } from "../message/types/metadata.js";
import type { OutboundPayload } from "../message/utils/prepare-outbound.js";
import type { EnvelopeOverrides } from "../types/envelope-overrides.js";
import type { IrisEnvelope } from "../types/iris-envelope.js";

export type { EnvelopeOverrides };

/**
 * Builds the wire envelope for a message, reading `@Priority`/`@Expiry` (and,
 * for the publish path, `@Broadcast`/`@Retry`) from the message metadata.
 *
 * `rpc: true` puts the builder in request/reply mode: broadcast and the retry
 * machinery do not apply to RPC (it is timeout-driven, single-shot), so those
 * are pinned to their neutral defaults while `@Priority`/`@Expiry` are still
 * honored. This is the single builder for every pattern — bus, queue, stream,
 * and RPC — so RPC no longer silently drops `@Priority`/`@Expiry`.
 */
export const buildEnvelope = (
  outbound: OutboundPayload,
  topic: string,
  metadata: MessageMetadata,
  overrides?: EnvelopeOverrides,
  rpc = false,
): IrisEnvelope => {
  const retry = rpc ? null : metadata.retry;

  return {
    payload: outbound.payload,
    headers: outbound.headers,
    topic,
    priority: overrides?.priority ?? metadata.priority ?? 0,
    timestamp: Date.now(),
    expiry: overrides?.expiry ?? metadata.expiry ?? null,
    broadcast: rpc ? false : metadata.broadcast,
    attempt: 0,
    maxRetries: retry?.maxRetries ?? 0,
    retryStrategy: retry?.strategy ?? "constant",
    retryDelay: retry?.delay ?? 1000,
    retryDelayMax: retry?.delayMax ?? 30000,
    retryMultiplier: retry?.multiplier ?? 2,
    retryJitter: retry?.jitter ?? false,
    replyTo: null,
    correlationId: null,
    identifierValue: overrides?.identifierValue ?? null,
  };
};
