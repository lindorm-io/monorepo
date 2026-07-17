import { encodeScalarHeaders } from "../../../codec/header-map-codec.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { KafkaMessage } from "../types/kafka-types.js";

/**
 * Header-map wire shape for Kafka: every scalar envelope field is an `x-iris-*`
 * message header (via the shared codec), the user headers ride as one JSON
 * header, the payload is the message value, and `identifierValue` is the
 * partition key (Kafka-only ordering — see {@link IdentifierField}).
 */
export const serializeKafkaMessage = (envelope: IrisEnvelope): KafkaMessage => ({
  key: envelope.identifierValue ?? null,
  value: envelope.payload,
  headers: {
    ...encodeScalarHeaders(envelope),
    "x-iris-headers": JSON.stringify(envelope.headers),
  },
});
