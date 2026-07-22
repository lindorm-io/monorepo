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
 * Translate a COSE `crit` (label 2) array into its JOSE wire form: each member is
 * an integer header LABEL (or a tstr), so an integer is mapped to its JOSE wire
 * NAME via the header registry (`headerByCose`) — the COSE twin of the JOSE crit
 * member remap. An unregistered integer has no wire name, so it is stringified;
 * a string member is already a name and passes through. Order is preserved to
 * mirror the raw JOSE wire header (which carries `crit` verbatim).
 */
const coseCritToWire = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;
  return value.map((member): string =>
    typeof member === "number"
      ? (headerByCose(member)?.jose ?? String(member))
      : String(member),
  );
};

/**
 * Translate a COSE `x5c` (label 33, RFC 9360 x5chain) into its JOSE wire form:
 * COSE carries the certificate chain as `bstr` (one cert) or `Array<bstr>` (a
 * chain) of DER bytes, whereas JOSE `x5c` is always `Array<base64-string>`. So
 * normalise to an array and base64-encode (standard base64, per RFC 7515 §4.1.6 —
 * NOT base64url) each byte string. A non-bstr value is left untouched.
 */
const coseX5cToWire = (value: unknown): unknown => {
  const members = Array.isArray(value) ? value : [value];
  if (!members.every((member) => member instanceof Uint8Array)) return value;
  return members.map((cert): string => B64.encode(cert));
};

/**
 * Shape ONE COSE header value into its JOSE wire form: the `alg` label integer
 * becomes its string algorithm name, byte strings (`kid`) become their utf-8
 * text, the base64url byte fields (`iv`/`p2s`/`tag`) become base64url strings,
 * `crit`'s member labels become their JOSE wire names, and `x5c`'s DER byte
 * strings become standard base64 — the exact representation a decoded JOSE header
 * carries. (`x5t` is deliberately UNREGISTERED for COSE — its COSE form is a
 * `COSE_CertHash` structure, not a base64url thumbprint relabel — so it never
 * reaches this shaper; see the header registry.)
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
    case "crit":
      return coseCritToWire(value);
    case "x5c":
      return coseX5cToWire(value);
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
