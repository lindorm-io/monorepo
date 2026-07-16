import type { Dict } from "@lindorm/types";
import { decode } from "cbor2";
import { CborError } from "../../errors/index.js";
import type { ResolvedCborSpec } from "../types/resolved-cbor-spec.js";
import { decodeValue } from "./decode-value.js";

export const decodeCbor = (config: ResolvedCborSpec, bytes: Uint8Array): Dict => {
  const map = decode<Map<number, unknown>>(bytes, { preferMap: true });

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

    // An unknown label is preserved verbatim under its numeric key — never dropped,
    // so a record written by a newer spec survives a round-trip through an older one.
    if (!field) {
      out[label] = wire;
      continue;
    }

    out[field.key] = decodeValue(field, wire);
  }

  return out;
};
