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
 * ⚠ AN UNRESOLVED MEMBER STRINGIFIES, so an integer member and its tstr twin come
 * back as the same wire name — the same collision {@link coseWireHeader}'s
 * `custom` bag documents below, from the same cause (a `Record<string, unknown>`
 * cannot key both label forms apart).
 *
 * ⛔ THE NAMED CONSEQUENCE: a protected bucket carrying the integer `crit` label 2
 * = `[7]` beside a tstr parameter `"7"` reads back as `crit: ["7"]` against a
 * custom bag keyed `"7"`, so `validateCrit`'s `Object.hasOwn` presence test
 * passes — RFC 9052 §3.1's fatal-error condition (a crit label whose parameter is
 * NOT in the protected bucket) goes unraised, and a caller that declares `"7"`
 * then accepts a member no parameter answers for. The
 * integer label 7 carries no parameter; a text one, which is a different label,
 * answered for it. Reachable at EVERY read door — `parse`, `decode` and `verify`
 * alike, since the crit gate reads the same merged view and runs ahead of the
 * signature cycle, so a conformant issuer signing the shape carries it through.
 * Both this and the bag collision are answered by the same change: typing the bag
 * `Map<CoseLabel, unknown>`.
 * pinned: `custom-header-params.read.test.ts#an INTEGER crit member is satisfied
 * by a TSTR parameter of the same numeral`.
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
 * Translate a single COSE `[label, value]` into the wire header, or — when no
 * registry row answers for the label — into the CUSTOM bag beside it, keyed by
 * `String(label)`. COSE_Encrypt0 is the one special case: its label 1 is the
 * content-encryption algorithm — the JOSE analogue of `enc`, not a key-management
 * `alg` — so it lands on `enc`.
 *
 * ⚠ AN UNREGISTERED LABEL IS CARRIED, NOT DROPPED. A foreign issuer may write
 * params aegis has never heard of, and a token aegis itself minted carries any
 * `custom` bag under its own tstr label (`build-cose-headers.ts`) — a skip would
 * make aegis unable to read back what it wrote. It cannot join `wire`: that bag
 * is a {@link WireTokenHeader}, whose type says an unregistered key does not
 * exist.
 *
 * ⚠⚠ `String(label)` CONFLATES THE TWO LABEL FORMS, and that is a stated
 * limitation rather than an oversight. RFC 9052 §1.4 makes the integer `7` and
 * the tstr `"7"` different labels; {@link CoseHeaderBuckets} types this bag as
 * `Record<string, unknown>`, so an integer label has nowhere to go but its
 * decimal spelling and a bucket carrying both yields ONE key, last write winning.
 * Honouring the distinction needs {@link CoseHeaderBuckets.custom} to be typed
 * `Map<CoseLabel, unknown>` rather than `Record<string, unknown>` — a change to a
 * PUBLIC read surface, which is why it is not made here. Pinned as the limitation
 * it is in `custom-header-params.read.test.ts`. `joseByCose` decides which labels
 * resolve, and it is deliberately narrow on the tstr side — only parameters aegis
 * can WRITE under a text label resolve back, so a foreign token cannot deliver a
 * REGISTERED parameter under a text label aegis never emits
 * (`internal/registry/is-private-use-label.ts`).
 *
 * ⚠ A registered label whose VALUE has no JOSE form (a `COSE_CertHash` under an
 * unrecognised hash algorithm — {@link coseValueToWire} returning `undefined`) is
 * still dropped, and does NOT fall through to the custom bag: the registry
 * answered for the label, so it is not custom, and reporting it under an integer
 * key would give one parameter two spellings in one result.
 *
 * ⛔ THE BAG IT WRITES INTO IS `Object.create(null)` — see {@link coseWireHeader}.
 * A tstr label is a key a stranger chose, and `"__proto__"` assigned onto a plain
 * object sets the prototype rather than the parameter.
 */
const assignCoseParam = (
  wire: Dict,
  custom: Dict,
  label: CoseLabel,
  value: unknown,
  algKind: CoseAlgKind,
): void => {
  if (label === ALG_LABEL && algKind === "enc") {
    if (isNumber(value)) wire.enc = coseLabelToEnc(value);
    return;
  }

  const jose = joseByCose(label);
  if (jose === undefined) {
    custom[String(label)] = value;
    return;
  }

  const shaped = coseValueToWire(jose, value);
  if (shaped === undefined) return;

  wire[shaped.jose] = shaped.value;
};

/**
 * Translate ONE COSE header map — a protected bucket or an unprotected one — into
 * the JOSE WIRE vocabulary ({@link WireTokenHeader}) plus the params no registry
 * row answers for, each registered label resolved to its JOSE wire name via the
 * header registry (`joseByCose`). The COSE twin of a decoded JOSE protected
 * header — same wire vocabulary, same two-bag split
 * (`internal/utils/jose-header.ts#decodeJoseHeader`).
 *
 * ⛔ THE CUSTOM BAGS ARE `Object.create(null)`: a tstr label is a key the token's
 * author chose, and `custom["__proto__"] = value` on a plain object DROPS the
 * parameter (this bag exists to carry it verbatim) and leaves the bag inheriting
 * whatever was assigned. A null-prototype object has no setter to hit and no
 * chain for a consumer's own `custom[key]` lookup to walk. The JOSE twin
 * (`internal/utils/jose-header.ts`) states the same rule for the same reason.
 *
 * ⚠ IT TRANSLATES ONE BUCKET, and merging the two here would make an unsigned
 * parameter indistinguishable from a signed one in every COSE kit result — a
 * `typ` no signature covers decides token-type routing and the profile floor.
 * The buckets travel separately all the way out ({@link CoseHeaderBuckets}), so a
 * reader has to name the one it trusts, and the custom bag is per-bucket for the
 * same reason.
 */
export const coseWireHeader = (
  map: Map<CoseLabel, unknown> | undefined,
  algKind: CoseAlgKind,
): { header: WireTokenHeader; custom: Dict } => {
  const wire: Dict = {};
  const custom: Dict = Object.create(null);

  if (map) {
    for (const [label, value] of map) {
      assignCoseParam(wire, custom, label, value, algKind);
    }
  }

  return { header: wire as WireTokenHeader, custom };
};
