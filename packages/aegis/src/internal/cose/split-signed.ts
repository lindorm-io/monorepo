import type { CoseError } from "../../errors/index.js";
import type { WireTokenHeader } from "../../types/index.js";
import { coseWireHeader } from "../header/cose-wire-header.js";
import { decodeCbor } from "./cbor.js";
import { requireCose } from "./require-cose.js";
import { decodeProtectedHeader } from "./structures.js";
import type { CoseArity } from "./unwrap-cose.js";

/** The wire segments of a signed COSE structure — COSE_Sign1 or COSE_Mac0 (RFC 9052). */
export type SignedSegments = {
  /** The protected header byte string — the Sig/MAC structure input, so it travels raw. */
  protectedBstr: Uint8Array;
  /**
   * ⚠ The payload byte string AS CBOR DECODED IT, which may be `null`: a
   * DETACHED payload is legal COSE. The read paths answer that differently — the
   * claims decode refuses it with a structural verdict, the opaque one has never
   * accepted a detached token at all — so the decision stays at the call site.
   */
  payload: Uint8Array | null | undefined;
  /**
   * ⚠ The signature (COSE_Sign1) or authentication tag (COSE_Mac0) bytes AS CBOR
   * DECODED THEM, which may be `null`: an `exactly: 4` arity counts ELEMENTS, not
   * non-nil ones, so a structure with `null` in slot 4 reaches here intact. Every
   * read path refuses it — `requireSignature` — but it is the CALL SITE that says
   * so, in its own words and under its own leaf error class.
   */
  signature: Uint8Array | null | undefined;
  /** The PROTECTED bucket in the JOSE wire vocabulary — the one a signature covers. */
  protectedHeader: WireTokenHeader;
  /** The UNPROTECTED bucket in the JOSE wire vocabulary; empty when there is none. */
  unprotectedHeader: WireTokenHeader;
};

/**
 * Decode a signed COSE token to its segments and its two WIRE header buckets, or
 * refuse it. The outer CWT tag (61) is stripped by `requireCose`, so a token
 * another producer did not envelope reads too.
 *
 * This is the ONE opening the three signed read paths share — the opaque
 * `CwsKit.decode` and `CwsKit.verify`, and the claims `decodeCwtWire` — written
 * three times before, each re-deriving the same protected/unprotected
 * translation. The signature cycle, the header gates and the payload
 * reconstruction stay with the callers, because that is where they differ. The
 * COSE_Encrypt0 twin is `splitEncrypt0`.
 *
 * ⚠ The two buckets travel SEPARATELY: an unprotected parameter is covered by no
 * signature, so a reader has to name the bucket it is willing to trust.
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

  return {
    protectedBstr,
    payload,
    signature,
    protectedHeader: coseWireHeader(decodeProtectedHeader(protectedBstr), "sig"),
    unprotectedHeader: coseWireHeader(
      unprotected instanceof Map ? unprotected : undefined,
      "sig",
    ),
  };
};
