import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { KafkaEachMessagePayload } from "../types/kafka-types.js";

const readHeader = (
  rawHeaders: Record<string, Buffer | undefined>,
  key: string,
): string | undefined => {
  const val = rawHeaders[key];
  if (val == null) return undefined;
  return Buffer.isBuffer(val) ? val.toString("utf8") : String(val);
};

export const parseKafkaMessage = (eachMessage: KafkaEachMessagePayload): IrisEnvelope => {
  const { message, topic: kafkaTopic } = eachMessage;
  const rawHeaders = message.headers ?? {};

  const topic = readHeader(rawHeaders, "x-iris-topic") ?? kafkaTopic;

  // Parse the application-level headers from the JSON-encoded x-iris-headers field
  let headers: Record<string, string> = {};
  const headersJson = readHeader(rawHeaders, "x-iris-headers");
  if (headersJson) {
    try {
      headers = JSON.parse(headersJson);
    } catch {
      headers = {};
    }
  }

  const expiry = readHeader(rawHeaders, "x-iris-expiry");
  const replyTo = readHeader(rawHeaders, "x-iris-reply-to");
  const correlationId = readHeader(rawHeaders, "x-iris-correlation-id");
  const timestamp = readHeader(rawHeaders, "x-iris-timestamp");

  return {
    topic,
    payload: message.value ?? Buffer.alloc(0),
    headers,
    priority: parseInt(readHeader(rawHeaders, "x-iris-priority") ?? "0", 10),
    timestamp: parseInt(timestamp ?? "0", 10),
    expiry: expiry && expiry !== "" ? parseInt(expiry, 10) : null,
    broadcast: readHeader(rawHeaders, "x-iris-broadcast") === "true",
    attempt: parseInt(readHeader(rawHeaders, "x-iris-attempt") ?? "0", 10),
    maxRetries: parseInt(readHeader(rawHeaders, "x-iris-max-retries") ?? "0", 10),
    retryStrategy:
      (readHeader(
        rawHeaders,
        "x-iris-retry-strategy",
      ) as IrisEnvelope["retryStrategy"]) ?? "constant",
    retryDelay: parseInt(readHeader(rawHeaders, "x-iris-retry-delay") ?? "1000", 10),
    retryDelayMax: parseInt(
      readHeader(rawHeaders, "x-iris-retry-delay-max") ?? "30000",
      10,
    ),
    retryMultiplier: parseFloat(readHeader(rawHeaders, "x-iris-retry-multiplier") ?? "2"),
    retryJitter: readHeader(rawHeaders, "x-iris-retry-jitter") === "true",
    replyTo: replyTo && replyTo !== "" ? replyTo : null,
    correlationId: correlationId && correlationId !== "" ? correlationId : null,
    identifierValue: message.key ? message.key.toString("utf8") : null,
  };
};
