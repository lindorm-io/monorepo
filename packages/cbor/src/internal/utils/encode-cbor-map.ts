import type { Dict } from "@lindorm/types";
import type { CborEncodeOptions } from "../../types/cbor-field.js";
import type { ResolvedCborSpec } from "../types/resolved-cbor-spec.js";
import { encodeValue } from "./encode-value.js";

// Build the intermediate CBOR map (wire label → wire value) WITHOUT serializing.
// This is the shared mapping layer: the byte codec serializes the result, and a
// consumer with its own CBOR serializer (e.g. aegis's COSE byte layer, which owns
// Tag/Buffer/CDE handling) hands the map straight on. Splitting here keeps every
// format-specific serialization concern out of this package.
export const encodeCborMap = (
  config: ResolvedCborSpec,
  value: Dict,
  options: CborEncodeOptions = {},
): Map<number | string, unknown> => {
  const resolved: CborEncodeOptions = { proprietary: options.proprietary ?? true };
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
    const wireKey = field.proprietary && !resolved.proprietary ? field.key : field.label;

    map.set(wireKey, encodeValue(field, raw, resolved));
  }

  return map;
};
