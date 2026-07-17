import { encodeScalarJson } from "../../../codec/json-body-codec.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { NatsMsgHeaders, SerializedNatsMessage } from "../types/nats-types.js";

export type { SerializedNatsMessage };

/**
 * JSON-body wire shape for NATS: the whole envelope is one JSON document —
 * base64 payload, then the scalar fields (typed, via the shared codec), then
 * the user headers. `identifierValue` is deliberately NOT carried: it is
 * Kafka-only ordering metadata and was dead payload here (see
 * {@link IdentifierField}, M12).
 */
export const serializeNatsMessage = (
  envelope: IrisEnvelope,
  _headersInit: () => NatsMsgHeaders,
): SerializedNatsMessage => {
  const json = JSON.stringify({
    payload: envelope.payload.toString("base64"),
    ...encodeScalarJson(envelope),
    headers: envelope.headers,
  });

  return { data: new TextEncoder().encode(json) };
};
