import { decodeScalarHeaders } from "../../../codec/header-map-codec.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { ParsedAmqpMessage } from "./parse-amqp-headers.js";

/**
 * Rebuild an {@link IrisEnvelope} from a parsed AMQP message. Scalar fields are
 * decoded from the `x-iris-*` headers via the shared codec — INCLUDING the full
 * retry-policy set, so retry policy is producer-authoritative on the wire and no
 * longer re-derived from the consumer's local `@Retry` (M2). `topic`, `priority`
 * and `timestamp` ride AMQP-native slots (routing key / properties), so they
 * override the header-decoded defaults. `identifierValue` is Kafka-only ordering
 * metadata and is never carried on the rabbit wire.
 */
export const buildRabbitEnvelope = (parsed: ParsedAmqpMessage): IrisEnvelope => ({
  ...decodeScalarHeaders((header) => parsed.irisHeaders[header]),
  topic: parsed.routingKey,
  priority: parsed.priority,
  timestamp: parsed.timestamp,
  payload: parsed.payload,
  headers: parsed.headers,
  identifierValue: null,
});
