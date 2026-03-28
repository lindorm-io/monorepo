import type { RedisStreamEntry } from "../types/redis-types";

export const parseStreamEntry = (id: string, fields: Array<string>): RedisStreamEntry => {
  const map = new Map<string, string>();

  for (let i = 0; i < fields.length; i += 2) {
    map.set(fields[i], fields[i + 1]);
  }

  return {
    id,
    payload: Buffer.from(map.get("payload") ?? "", "base64"),
    headers: JSON.parse(map.get("headers") ?? "{}"),
    topic: map.get("topic") ?? "",
    attempt: parseInt(map.get("attempt") ?? "0", 10),
    maxRetries: parseInt(map.get("maxRetries") ?? "0", 10),
    retryStrategy: (map.get("retryStrategy") ?? "constant") as
      | "constant"
      | "linear"
      | "exponential",
    retryDelay: parseInt(map.get("retryDelay") ?? "1000", 10),
    retryDelayMax: parseInt(map.get("retryDelayMax") ?? "30000", 10),
    retryMultiplier: parseFloat(map.get("retryMultiplier") ?? "2"),
    retryJitter: map.get("retryJitter") === "true",
    priority: parseInt(map.get("priority") ?? "0", 10),
    timestamp: parseInt(map.get("timestamp") ?? "0", 10),
    expiry: map.get("expiry") ? parseInt(map.get("expiry")!, 10) : null,
    broadcast: map.get("broadcast") === "true",
    replyTo: map.get("replyTo") || null,
    correlationId: map.get("correlationId") || null,
    identifierValue: map.get("identifierValue") || null,
  };
};
