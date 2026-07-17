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
 *
 * Topic exception: a retry message carries an explicit `x-iris-topic` header
 * because dead-lettering it back to the failing consumer's queue rewrites the
 * AMQP routing key to that queue's name (queue-targeted retry). When present, the
 * header is authoritative and the (now queue-name) routing key is ignored —
 * mirroring the Kafka consumer's `x-iris-topic`-over-native-slot precedence.
 */
export const buildRabbitEnvelope = (parsed: ParsedAmqpMessage): IrisEnvelope => {
  const scalars = decodeScalarHeaders((header) => parsed.irisHeaders[header]);

  return {
    ...scalars,
    topic:
      parsed.irisHeaders["x-iris-topic"] !== undefined
        ? scalars.topic
        : parsed.routingKey,
    priority: parsed.priority,
    timestamp: parsed.timestamp,
    payload: parsed.payload,
    headers: parsed.headers,
    identifierValue: null,
  };
};
