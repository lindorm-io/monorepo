import type { Dict } from "@lindorm/types";
import { encode } from "cbor2";
import type { ResolvedCborSpec } from "../types/resolved-cbor-spec.js";
import { encodeValue } from "./encode-value.js";

export const encodeCbor = (
  config: ResolvedCborSpec,
  value: Dict,
  proprietary = true,
): Uint8Array => {
  const map = new Map<number | string, unknown>();

  if (config.version) {
    map.set(config.version.label, config.version.value);
  }

  for (const field of config.fields) {
    const raw = value[field.key];

    // Present-only encoding: absent, null, and empty-text fields are never written.
    if (raw === undefined || raw === null) continue;
    if (field.kind === "text" && raw === "") continue;

    // A proprietary field degrades from its compact integer label to its string
    // key off-platform (proprietary:false); every other field keys by its label.
    const wireKey = field.proprietary && !proprietary ? field.key : field.label;

    map.set(wireKey, encodeValue(field, raw));
  }

  return encode(map, { cde: true });
};
