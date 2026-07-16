import type { Dict } from "@lindorm/types";
import { decode } from "cbor2";
import { CborError } from "../../errors/index.js";
import type { ResolvedCborSpec } from "../types/resolved-cbor-spec.js";
import { decodeValue } from "./decode-value.js";

export const decodeCbor = (config: ResolvedCborSpec, bytes: Uint8Array): Dict => {
  const map = decode<Map<number | string, unknown>>(bytes, { preferMap: true });

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
    //   - "lax": preserve it verbatim under its numeric key — never dropped, so a
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
        details: `The record carries label ${label}, which no field in this spec recognises; this is a closed format (mode "strict").`,
        data: { label },
      });
    }

    out[field.key] = decodeValue(field, wire);
  }

  return out;
};
