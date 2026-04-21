import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { OutboundPayload } from "../message/utils/prepare-outbound.js";

export const createDefaultEnvelope = (
  outbound: OutboundPayload,
  topic: string,
  overrides?: Partial<IrisEnvelope>,
): IrisEnvelope => ({
  topic,
  payload: outbound.payload,
  headers: outbound.headers,
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 0,
  retryStrategy: "constant",
  retryDelay: 1000,
  retryDelayMax: 30000,
  retryMultiplier: 2,
  retryJitter: false,
  replyTo: null,
  correlationId: null,
  identifierValue: null,
  ...overrides,
});
