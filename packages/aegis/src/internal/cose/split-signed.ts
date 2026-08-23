import type { Dict } from "@lindorm/types";
import type { CoseError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import type { CoseLabel } from "./cose-label.js";
import { coseWireHeader } from "../header/cose-wire-header.js";
import { decodeCbor } from "./cbor.js";
import { requireBstr } from "./require-bstr.js";
import { requireCose } from "./require-cose.js";
import { decodeProtectedHeader } from "./structures.js";
import type { CoseArity } from "./unwrap-cose.js";

/** The wire segments of a signed COSE structure — COSE_Sign1 or COSE_Mac0. */
export type SignedSegments = {
  /** The protected header byte string — the Sig/MAC structure input, so it travels raw. */
  protectedBstr: Buffer;
  /**
   * ⚠ The payload slot AS CBOR DECODED IT — `unknown` because the arity gate
   * counts ELEMENTS and nothing before this point checks the slot's type, so a
   * producer that does not conform to RFC 9052 §4.2, RFC 9052 §6.2 arrives here
   * with any CBOR type. Every read path refuses a nil slot, but in its own words,
   * so the decision stays at the call site; `requireBstr` is what reaches the bytes.
   */
  payload: unknown;
  /**
   * ⚠ The signature or authentication tag slot AS CBOR DECODED IT — `unknown` for
   * the same reason as `payload`: RFC 9052 §4.2, RFC 9052 §6.2 constrain it and
   * the arity gate does not enforce them. `requireBstr` refuses a non-bstr at the
   * call site, under that site's own leaf error class.
   */
  signature: unknown;
  /** The PROTECTED bucket in the JOSE wire vocabulary — the one a signature covers. */
  protectedHeader: WireTokenHeader;
  /**
   * The SAME bucket as its RAW COSE label map, decoded once and handed on beside
   * the translated one.
   *
   * ⚠ It exists because the translation is LOSSY BY DESIGN: the JOSE wire
   * vocabulary has no parameter for a `COSE_CertHash` under SHA-384 or SHA-512
   * (RFC 7515 §4.1.7, RFC 7515 §4.1.8), so such a binding leaves the translated
   * header and `cose-wide-cert-binding.ts` reads it here.
   */
  protectedMap: Map<CoseLabel, unknown>;
  /** The UNPROTECTED bucket in the JOSE wire vocabulary; empty when there is none. */
  unprotectedHeader: WireTokenHeader;
  /**
   * Each bucket's params no registry row answers for, VERBATIM and keyed by
   * `String(label)` — see {@link CoseHeaderBuckets.custom}. They stay out of the
   * two translated buckets above, whose type says an unregistered key cannot
   * exist.
   */
  custom: { protected: Dict; unprotected: Dict };
};

/**
 * Decode a signed COSE token to its segments and its two WIRE header buckets, or
 * refuse it. `requireCose` strips the outer CWT tag, so an un-enveloped token
 * reads too.
 *
 * The ONE opening every signed read path shares. The signature cycle, the header
 * gates and the payload reconstruction stay with the callers, because that is
 * where they differ. The COSE_Encrypt0 twin is `splitEncrypt0`.
 *
 * ⚠ The two buckets travel SEPARATELY: no signature covers an unprotected
 * parameter, so a reader has to name the bucket it is willing to trust.
 */
export const splitSigned = (
  token: Buffer,
  {
    arity,
    tags,
    error,
    message,
    title,
    arityDetails,
    protectedDetails,
  }: {
    arity: CoseArity;
    tags?: ReadonlyArray<number>;
    error: typeof CoseError;
    message: string;
    title: string;
    /** What a structure of the wrong SHAPE costs, in the caller's words. */
    arityDetails: string;
    /**
     * What a slot-0 holding something other than a byte string costs, in the
     * caller's words. ⚠ A SEPARATE string, because the two refusals share the
     * `cose_malformed` code: handed the arity sentence, a reader whose structure
     * has the right element count is told nothing that is true of its token.
     */
    protectedDetails: string;
  },
): SignedSegments => {
  const contents = requireCose(decodeCbor(token), {
    arity,
    tags,
    error,
    message,
    title,
    details: arityDetails,
  });

  // The protected bucket is a bstr in every signed structure (RFC 9052 §3), so the
  // refusal is identical on every path and belongs here rather than copied to each
  // reader. ⚠ `decodeProtectedHeader` (`structures.ts`) judges the CBOR INSIDE the
  // byte string and never the slot's own type, so this is the only gate that can
  // name a non-bstr slot 0 — and the only one keeping it inside the `AegisError`
  // contract a caller branches on to answer 401 rather than 500.
  const protectedBstr = requireBstr(contents[0], {
    error,
    message,
    title,
    details: protectedDetails,
  });
  const [, unprotected, payload, signature] = contents;

  // Decoded ONCE and used twice: a second decode is a second chance for the raw
  // and translated buckets to disagree about the same bytes.
  const protectedMap = decodeProtectedHeader(protectedBstr);

  const protectedWire = coseWireHeader(protectedMap, "sig");
  const unprotectedWire = coseWireHeader(
    unprotected instanceof Map ? unprotected : undefined,
    "sig",
  );

  return {
    protectedBstr,
    payload,
    signature,
    protectedMap,
    protectedHeader: protectedWire.header,
    unprotectedHeader: unprotectedWire.header,
    custom: { protected: protectedWire.custom, unprotected: unprotectedWire.custom },
  };
};
