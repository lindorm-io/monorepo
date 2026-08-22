import type { Dict } from "@lindorm/types";
import type { CoseError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import type { CoseLabel } from "./cose-label.js";
import { coseWireHeader } from "../header/cose-wire-header.js";
import { decodeCbor } from "./cbor.js";
import { requireCose } from "./require-cose.js";
import { decodeProtectedHeader } from "./structures.js";
import type { CoseArity } from "./unwrap-cose.js";

/** The wire segments of a signed COSE structure — COSE_Sign1 or COSE_Mac0. */
export type SignedSegments = {
  /** The protected header byte string — the Sig/MAC structure input, so it travels raw. */
  protectedBstr: Uint8Array;
  /**
   * ⚠ The payload byte string AS CBOR DECODED IT, which may be `null`: a DETACHED
   * payload is legal COSE. Every read path refuses it, but in its own words, so
   * the decision stays at the call site.
   */
  payload: Uint8Array | null | undefined;
  /**
   * ⚠ The signature or authentication tag bytes AS CBOR DECODED THEM, which may be
   * `null`: an `exactly: 4` arity counts ELEMENTS, not non-nil ones, so `null` in
   * slot 4 reaches here intact. `requireSignature` refuses it at the call site,
   * under that site's own leaf error class.
   */
  signature: Uint8Array | null | undefined;
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
    details,
  }: {
    arity: CoseArity;
    tags?: ReadonlyArray<number>;
    error: typeof CoseError;
    message: string;
    title: string;
    details: string;
  },
): SignedSegments => {
  const [protectedBstr, unprotected, payload, signature] = requireCose(
    decodeCbor(token),
    { arity, tags, error, message, title, details },
  ) as [
    Uint8Array,
    unknown,
    Uint8Array | null | undefined,
    Uint8Array | null | undefined,
  ];

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
