import type { Dict } from "@lindorm/types";
import { CborError } from "../../errors/index.js";
import type { ResolvedCborSpec } from "../types/resolved-cbor-spec.js";
import { decodeValue } from "./decode-value.js";

// Map an already-decoded CBOR map back to the domain record WITHOUT deserializing.
// The shared mapping layer: the byte codec decodes the bytes first, and a consumer
// with its own CBOR decoder (e.g. aegis's COSE byte layer, which owns preferMap /
// duplicate-key policy) hands the map straight in.
export const decodeCborMap = (
  config: ResolvedCborSpec,
  map: Map<number | string, unknown>,
): Dict => {
  if (config.version) {
    const version = map.get(config.version.label);

    if (version !== config.version.value) {
      throw new CborError("CBOR version mismatch", {
        code: "version_mismatch",
        title: "Version Mismatch",
        details: `Expected version ${config.version.value} but the record declared ${String(version)}.`,
      });
    }
  }

  const out: Dict = {};

  for (const [label, wire] of map) {
    if (config.version && label === config.version.label) continue;

    const field = config.byLabel.get(label);

    // An unrecognised wire label is handled per the spec's mode:
    //   - "lax": preserve it verbatim under its wire key — never dropped, so a
    //     record written by a newer spec survives a round-trip through an older one.
    //   - "strict" (default): treat it as corruption of a closed format and throw.
    if (!field) {
      if (config.mode === "lax") {
        out[label] = wire;
        continue;
      }

      throw new CborError("Unknown CBOR label", {
        code: "unknown_label",
        title: "Unknown CBOR Label",
        details: `The record carries label ${String(label)}, which no field in this spec recognises; this is a closed format (mode "strict").`,
        data: { label },
      });
    }

    out[field.key] = decodeValue(field, wire);
  }

  return out;
};
