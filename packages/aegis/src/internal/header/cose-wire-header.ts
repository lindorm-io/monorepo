import { B64 } from "@lindorm/b64";
import { isNumber } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { B64U } from "../constants/format.js";
import { coseLabelToAlg } from "../cose/alg-labels.js";
import { decodeCoseCertHash } from "../cose/cose-cert-hash.js";
import type { CoseLabel } from "../cose/cose-label.js";
import { decodeCoseX509 } from "../cose/cose-x509.js";
import { coseLabelToEnc } from "../cose/enc-labels.js";
import type { CoseHeaderCodec } from "../registry/cose-header-codec.js";
import { coseByJose, coseHeaderCodec, joseByCose } from "./header-registry.js";

/**
 * How the COSE `alg` label (1) is interpreted: a signature/MAC algorithm (the
 * COSE_Sign1/Mac0 case, → JOSE `alg`) or a content-encryption algorithm (the
 * COSE_Encrypt0 case, where label 1 carries the AEAD, → JOSE `enc`).
 */
export type CoseAlgKind = "sig" | "enc";

/** The COSE integer label for the `alg` header parameter (RFC 9052 §3.1). */
const ALG_LABEL = coseByJose("alg");

/**
 * Translate a COSE `crit` (label 2) array into its JOSE wire form: RFC 9052 §1.5
 * defines `label = int / tstr`, so a member is an integer header LABEL or a text
 * one. BOTH go through the header registry (`joseByCose`), which resolves either
 * spelling of the same parameter — the COSE twin of the JOSE crit member remap.
 * A member the registry does not answer for has no wire name, so it is
 * stringified. Order is preserved to mirror the raw JOSE wire header (which
 * carries `crit` verbatim).
 *
 * This is the exact inverse of the write side (`wireHeaderToCoseMap`), which
 * emits each member as the LABEL the parameter itself is keyed under. The two
 * disagreed until 2026-08-11: the writer emitted wire NAMES while a parameter sat
 * at its integer label, so a token aegis minted named, in its own `crit`, a label
 * that was not in its own protected bucket — RFC 9052 §3.1's explicit fatal
 * error, on our own output.
 */
const coseCritToWire = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;
  return value.map((member): string => {
    const label: CoseLabel = isNumber(member) ? member : String(member);
    return joseByCose(label) ?? String(member);
  });
};

/**
 * Shape ONE COSE header value into its JOSE wire form and say WHICH JOSE
 * parameter it belongs to, dispatched on the registry's `cose` codec cell. The
 * read half of the per-wire codec; `token-header.ts#encodeCoseHeaderValue` is the
 * write half.
 *
 * ⚠ IT RETURNS THE TARGET PARAMETER, not just the value, and that is the one
 * piece of machinery COSE's certificate binding needs: RFC 9360 §2 gives COSE ONE
 * `x5t` (label 34) whose hash algorithm is a member of the VALUE, while JOSE names
 * the algorithm in the parameter — so a single wire label has to reach either
 * `x5t#S256` or `x5t`. Every other codec answers with the label's own parameter.
 *
 * `undefined` DROPS the parameter: a `COSE_CertHash` under a hash algorithm aegis
 * has no JOSE parameter for has no representation in this vocabulary, and a wire
 * header reports what a producer wrote in terms this package can name.
 */
const coseValueToWire = (
  jose: string,
  value: unknown,
): { jose: string; value: unknown } | undefined => {
  const codec: CoseHeaderCodec = coseHeaderCodec(jose);

  switch (codec.kind) {
    case "algorithmLabel":
      return { jose, value: isNumber(value) ? coseLabelToAlg(value) : value };
    case "textBytes":
      return {
        jose,
        value: value instanceof Uint8Array ? Buffer.from(value).toString("utf8") : value,
      };
    case "base64Bytes":
      return {
        jose,
        value: value instanceof Uint8Array ? B64.encode(Buffer.from(value), B64U) : value,
      };
    case "critical":
      return { jose, value: coseCritToWire(value) };
    case "certChain":
      return { jose, value: decodeCoseX509(value) };
    case "certHash":
      return decodeCoseCertHash(value);
    case "passthrough":
      return { jose, value };
    default: {
      // `noImplicitReturns` is off repo-wide, so without this a new codec kind
      // would silently yield `undefined` and DROP the parameter on read.
      const exhaustive: never = codec;
      throw new CoseError("Unhandled COSE header value kind", {
        code: "header_unhandled_cose_value_kind",
        data: { jose, kind: String((exhaustive as CoseHeaderCodec).kind) },
        title: "Unhandled COSE Header Value Kind",
        details:
          "The header registry declares a COSE value kind the reader does not handle, so the parameter has no JOSE wire form.",
      });
    }
  }
};

/**
 * Translate a single COSE `[label, value]` into the merged wire header. An
 * unregistered label has no JOSE wire name, so it is skipped (a wire header
 * speaks only the registered vocabulary). COSE_Encrypt0 is the one special case:
 * its label 1 is the content-encryption algorithm — the JOSE analogue of `enc`,
 * not a key-management `alg` — so it lands on `enc`.
 *
 * ⚠ The label is a {@link CoseLabel}: a token minted with the interoperable
 * default keys its private-use parameters by their STRING label, so the read side
 * has to answer for both spellings or aegis would not read back the token it just
 * wrote. `joseByCose` resolves either, and only for the parameters that can be
 * written that way.
 */
const assignCoseParam = (
  wire: Dict,
  label: CoseLabel,
  value: unknown,
  algKind: CoseAlgKind,
): void => {
  if (label === ALG_LABEL && algKind === "enc") {
    if (isNumber(value)) wire.enc = coseLabelToEnc(value);
    return;
  }

  const jose = joseByCose(label);
  if (jose === undefined) return;

  const shaped = coseValueToWire(jose, value);
  if (shaped === undefined) return;

  wire[shaped.jose] = shaped.value;
};

/**
 * Translate ONE COSE header map — a protected bucket or an unprotected one — into
 * the JOSE WIRE vocabulary ({@link WireTokenHeader}), each integer label resolved
 * to its JOSE wire name via the header registry (`joseByCose`). The COSE twin of
 * a decoded JOSE protected header — same wire vocabulary.
 *
 * ⚠ It translates ONE BUCKET. This used to merge the two, protected last, which
 * is what made an unsigned parameter indistinguishable from a signed one in every
 * COSE kit result: a `typ` no signature covered decided token-type routing and
 * the profile floor. The buckets now travel separately all the way out
 * ({@link WireHeaderBuckets}), so a reader has to name the one it trusts.
 */
export const coseWireHeader = (
  map: Map<CoseLabel, unknown> | undefined,
  algKind: CoseAlgKind,
): WireTokenHeader => {
  const wire: Dict = {};

  if (map) {
    for (const [label, value] of map) {
      assignCoseParam(wire, label, value, algKind);
    }
  }

  return wire as WireTokenHeader;
};
