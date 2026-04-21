import type { ConsumeMessage } from "amqplib";
import type { ParsedAmqpMessage } from "../types/rabbit-types.js";

export type { ParsedAmqpMessage };

export const parseAmqpHeaders = (msg: ConsumeMessage): ParsedAmqpMessage => {
  const rawHeaders = (msg.properties.headers ?? {}) as Record<string, unknown>;
  const userHeaders: Record<string, string> = {};
  const irisHeaders: Record<string, string> = {};

  // Headers that must be passed through to prepareInbound for proper
  // message processing (encryption, compression).
  const passthroughIrisHeaders = new Set(["x-iris-encrypted", "x-iris-compression"]);

  for (const [key, value] of Object.entries(rawHeaders)) {
    const strValue = Buffer.isBuffer(value) ? value.toString() : String(value ?? "");
    if (key.startsWith("x-iris-")) {
      irisHeaders[key] = strValue;
      if (passthroughIrisHeaders.has(key)) {
        userHeaders[key] = strValue;
      }
    } else {
      userHeaders[key] = strValue;
    }
  }

  return {
    payload: msg.content,
    headers: userHeaders,
    envelope: {
      topic: msg.fields.routingKey,
      timestamp: msg.properties.timestamp ?? Date.now(),
      attempt: Number(irisHeaders["x-iris-attempt"] ?? 0),
      correlationId: irisHeaders["x-iris-correlation-id"] ?? null,
      replyTo: irisHeaders["x-iris-reply-to"] ?? null,
      expiry: irisHeaders["x-iris-expiry"] ? Number(irisHeaders["x-iris-expiry"]) : null,
      broadcast: irisHeaders["x-iris-broadcast"] === "true",
      priority: msg.properties.priority ?? 0,
    },
  };
};
