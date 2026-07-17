import { decodeScalarHeaders } from "../../../codec/header-map-codec.js";
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
  const read = (key: string): string | undefined => readHeader(rawHeaders, key);

  const scalars = decodeScalarHeaders(read);

  // Parse the application-level headers from the JSON-encoded x-iris-headers field
  let headers: Record<string, string> = {};
  const headersJson = read("x-iris-headers");
  if (headersJson) {
    try {
      headers = JSON.parse(headersJson);
    } catch {
      headers = {};
    }
  }

  return {
    ...scalars,
    // The Kafka topic name is the fallback when the producer omitted the header.
    topic: read("x-iris-topic") !== undefined ? scalars.topic : kafkaTopic,
    payload: message.value ?? Buffer.alloc(0),
    headers,
    identifierValue: message.key ? message.key.toString("utf8") : null,
  };
};
