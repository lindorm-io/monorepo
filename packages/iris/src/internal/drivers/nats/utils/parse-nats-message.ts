import { decodeScalarJson } from "../../../codec/json-body-codec.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";

export const parseNatsMessage = (data: Uint8Array): IrisEnvelope => {
  const json = JSON.parse(new TextDecoder().decode(data));

  return {
    ...decodeScalarJson(json),
    payload: Buffer.from(json.payload ?? "", "base64"),
    headers: json.headers ?? {},
    // Kafka-only ordering metadata — never carried on the NATS wire (M12).
    identifierValue: null,
  };
};
