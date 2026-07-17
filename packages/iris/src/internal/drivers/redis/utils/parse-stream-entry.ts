import { decodeScalarFieldsFromMap } from "../../../codec/flat-hash-codec.js";
import type { RedisStreamEntry } from "../types/redis-types.js";

export const parseStreamEntry = (id: string, fields: Array<string>): RedisStreamEntry => {
  const map = new Map<string, string>();

  for (let i = 0; i < fields.length; i += 2) {
    map.set(fields[i], fields[i + 1]);
  }

  return {
    id,
    ...decodeScalarFieldsFromMap(map),
    payload: Buffer.from(map.get("payload") ?? "", "base64"),
    headers: JSON.parse(map.get("headers") ?? "{}"),
    // Kafka-only ordering metadata — never carried on the Redis wire (M12).
    identifierValue: null,
  };
};
