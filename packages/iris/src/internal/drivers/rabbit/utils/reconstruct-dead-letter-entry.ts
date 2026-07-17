import type amqplib from "amqplib";
import { randomId } from "@lindorm/random";
import type { DeadLetterEntry } from "../../../../types/dead-letter.js";

const headerString = (value: unknown): string | undefined => {
  if (value == null) return undefined;
  return Buffer.isBuffer(value) ? value.toString() : String(value);
};

/**
 * Rabbit dead-letters natively (DLX + DLQ), so there is no in-process
 * DeadLetterManager to read from. Reconstruct a portable `DeadLetterEntry` from
 * a raw AMQP DLQ message: the failing topic is the routing key, the error and
 * its timestamp are carried on the `x-iris-error*` headers the consumer stamps
 * when it forwards to the DLX (see wrap-rabbit-consumer).
 */
export const reconstructDeadLetterEntry = (msg: amqplib.GetMessage): DeadLetterEntry => {
  const headers = (msg.properties.headers ?? {}) as Record<string, unknown>;
  const topic = String(msg.fields.routingKey ?? "");
  const error = headerString(headers["x-iris-error"]) ?? "unknown error";
  const errorTimestamp = headerString(headers["x-iris-error-timestamp"]);
  const timestamp = errorTimestamp
    ? Number(errorTimestamp)
    : (msg.properties.timestamp ?? Date.now());

  return {
    id: msg.properties.messageId ?? randomId({ namespace: "dlq", length: 16 }),
    envelope: {
      topic,
      payload: msg.content,
      headers: {},
      priority: msg.properties.priority ?? 0,
      timestamp: msg.properties.timestamp ?? timestamp,
      expiry: null,
      broadcast: false,
      attempt: 0,
      maxRetries: 0,
      retryStrategy: "constant",
      retryDelay: 0,
      retryDelayMax: 0,
      retryMultiplier: 0,
      retryJitter: false,
      replyTo: msg.properties.replyTo ?? null,
      correlationId: msg.properties.correlationId ?? null,
      identifierValue: null,
    },
    error,
    errorStack: null,
    attempt: 0,
    timestamp,
    topic,
  };
};
