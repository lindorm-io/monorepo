import { B64 } from "@lindorm/b64";
import type { Dict } from "@lindorm/types";
import type { WireTokenHeader } from "../../types/index.js";
import { B64U } from "../constants/format.js";
import { coseLabelToAlg } from "../cose/alg-labels.js";
import { coseLabelToEnc } from "../cose/enc-labels.js";
import { coseByJose, headerByCose } from "./header-registry.js";

/**
 * How the COSE `alg` label (1) is interpreted: a signature/MAC algorithm (the
 * COSE_Sign1/Mac0 case, → JOSE `alg`) or a content-encryption algorithm (the
 * COSE_Encrypt0 case, where label 1 carries the AEAD, → JOSE `enc`).
 */
export type CoseAlgKind = "sig" | "enc";

/** The COSE integer label for the `alg` header parameter (RFC 9052 §3.1). */
const ALG_LABEL = coseByJose("alg");

/**
 * Shape ONE COSE header value into its JOSE wire form: the `alg` label integer
 * becomes its string algorithm name, byte strings (`kid`) become their utf-8
 * text, and the base64url byte fields (`iv`/`p2s`/`tag`) become base64url
 * strings — the exact representation a decoded JOSE header carries.
 */
const coseValueToWire = (jose: string, value: unknown): unknown => {
  switch (jose) {
    case "alg":
      return typeof value === "number" ? coseLabelToAlg(value) : value;
    case "kid":
      return value instanceof Uint8Array ? Buffer.from(value).toString("utf8") : value;
    case "iv":
    case "p2s":
    case "tag":
      return value instanceof Uint8Array ? B64.encode(Buffer.from(value), B64U) : value;
    default:
      return value;
  }
};

/**
 * Translate a single COSE `[label, value]` into the merged wire header. An
 * unregistered label has no JOSE wire name, so it is skipped (a wire header
 * speaks only the registered vocabulary). COSE_Encrypt0 is the one special case:
 * its label 1 is the content-encryption algorithm — the JOSE analogue of `enc`,
 * not a key-management `alg` — so it lands on `enc`.
 */
const assignCoseParam = (
  wire: Dict,
  label: number,
  value: unknown,
  algKind: CoseAlgKind,
): void => {
  if (label === ALG_LABEL && algKind === "enc") {
    if (typeof value === "number") wire.enc = coseLabelToEnc(value);
    return;
  }

  const spec = headerByCose(label);
  if (!spec) return;

  wire[spec.jose] = coseValueToWire(spec.jose, value);
};

/**
 * Merge a COSE protected + unprotected header map into ONE unified WIRE header
 * ({@link WireTokenHeader}), translating each integer label to its JOSE wire
 * name via the header registry (`headerByCose`). PROTECTED wins on conflict: the
 * unprotected map is applied first, then the protected map overwrites it. This
 * is the COSE twin of a decoded JOSE protected header — same wire vocabulary.
 */
export const mergeCoseWireHeader = (
  protectedMap: Map<number, unknown>,
  unprotectedMap: Map<number, unknown> | undefined,
  algKind: CoseAlgKind,
): WireTokenHeader => {
  const wire: Dict = {};

  if (unprotectedMap) {
    for (const [label, value] of unprotectedMap) {
      assignCoseParam(wire, label, value, algKind);
    }
  }

  for (const [label, value] of protectedMap) {
    assignCoseParam(wire, label, value, algKind);
  }

  return wire as WireTokenHeader;
};
