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
    irisHeaders,
    priority: msg.properties.priority ?? 0,
    timestamp: msg.properties.timestamp ?? Date.now(),
    routingKey: msg.fields.routingKey,
  };
};
