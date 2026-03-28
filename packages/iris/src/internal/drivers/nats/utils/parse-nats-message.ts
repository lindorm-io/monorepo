import type { IrisEnvelope } from "../../../types/iris-envelope";

export const parseNatsMessage = (data: Uint8Array): IrisEnvelope => {
  const json = JSON.parse(new TextDecoder().decode(data));

  return {
    payload: Buffer.from(json.payload ?? "", "base64"),
    headers: json.headers ?? {},
    topic: json.topic ?? "",
    attempt: json.attempt ?? 0,
    maxRetries: json.maxRetries ?? 0,
    retryStrategy: json.retryStrategy ?? "constant",
    retryDelay: json.retryDelay ?? 1000,
    retryDelayMax: json.retryDelayMax ?? 30000,
    retryMultiplier: json.retryMultiplier ?? 2,
    retryJitter: json.retryJitter === true,
    priority: json.priority ?? 0,
    timestamp: json.timestamp ?? 0,
    expiry: json.expiry ?? null,
    broadcast: json.broadcast === true,
    replyTo: json.replyTo || null,
    correlationId: json.correlationId || null,
    identifierValue: json.identifierValue || null,
  };
};
