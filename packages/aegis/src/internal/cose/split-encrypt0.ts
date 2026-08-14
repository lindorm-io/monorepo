import { CweError } from "../../errors/index.js";
import { decodeCbor } from "./cbor.js";
import { requireCose } from "./require-cose.js";
import { COSE_TAG } from "./structures.js";

/** The three wire segments of a COSE_Encrypt0 (RFC 9052 §5.2). */
export type Encrypt0Segments = {
  /** The protected header byte string — the AAD input, so it travels raw. */
  protectedBstr: Uint8Array;
  /**
   * The unprotected bucket AS CBOR DECODED IT. Deliberately `unknown`: nothing
   * has checked it is a map, and the two read paths answer that differently —
   * `decode` narrows with `instanceof Map`, `decrypt` reads the IV straight off
   * it. Typing it as a `Map` here would only move the unchecked assertion.
   */
  unprotected: unknown;
  /** The COSE ciphertext, which is `ciphertext ‖ tag`. */
  coseCiphertext: Uint8Array;
};

/**
 * Decode a CWE token to the COSE_Encrypt0 segments, or refuse it. The outer CWT
 * tag (61) is stripped, so a token another producer did not envelope reads too.
 *
 * This is the ONE opening both `CweKit.decrypt` and `CweKit.decode` share; the
 * IV read, the tag split and the AEAD stay with `decrypt`, because `decode` must
 * keep reading a header-only COSE_Encrypt0 that carries neither.
 */
export const splitEncrypt0 = (token: Buffer): Encrypt0Segments => {
  const [protectedBstr, unprotected, coseCiphertext] = requireCose(decodeCbor(token), {
    arity: { exactly: 3 },
    tags: [COSE_TAG.encrypt0],
    error: CweError,
    message: "Malformed COSE_Encrypt0",
    title: "Malformed COSE_Encrypt0",
    details:
      "A COSE_Encrypt0 must be a 3-element array [protected, unprotected, ciphertext].",
  }) as [Uint8Array, unknown, Uint8Array];

  return { protectedBstr, unprotected, coseCiphertext };
};
