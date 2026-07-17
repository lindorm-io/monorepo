import { encodeScalarFields } from "../../../codec/flat-hash-codec.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";

/**
 * Flat-hash wire shape for Redis streams: `payload` (base64) and `headers`
 * (JSON) as structural fields, then every scalar field/value pair (via the
 * shared codec). `identifierValue` is deliberately NOT carried — it is
 * Kafka-only ordering metadata that was dead payload here (see
 * {@link IdentifierField}, M12).
 */
export const serializeStreamFields = (envelope: IrisEnvelope): Array<string> => [
  "payload",
  envelope.payload.toString("base64"),
  "headers",
  JSON.stringify(envelope.headers),
  ...encodeScalarFields(envelope),
];
