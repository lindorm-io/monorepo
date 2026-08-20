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
        // ⚠ NOT `out[label] = wire`. `label` is read straight off the wire, so a
        // record carrying the tstr label `"__proto__"` invokes the prototype
        // setter instead of writing an own key: the member is DROPPED and the
        // record chooses the decoded object's prototype — the inverse of this
        // mode's contract above. `defineProperty` writes an own data property
        // under any key, including that one. Same disposal as `@lindorm/utils`
        // `omit-from-object.ts`. Pinned in `decode-cbor.test.ts`, which asserts
        // on the PROPERTY: a swapped prototype serialises as absent, so a
        // `JSON.stringify`/`toEqual` check reads clean on the hostile input.
        Object.defineProperty(out, label, {
          value: wire,
          writable: true,
          enumerable: true,
          configurable: true,
        });
        continue;
      }

      throw new CborError("Unknown CBOR label", {
        code: "unknown_label",
        title: "Unknown CBOR Label",
        details: `The record carries label ${String(label)}, which no field in this spec recognises; this is a closed format (mode "strict").`,
        data: { label },
      });
    }

    // Closed key, unlike the wire label above: `field.key` is declared by the
    // spec (`types/cbor-field.ts`), never read off the record.
    out[field.key] = decodeValue(field, wire);
  }

  return out;
};
