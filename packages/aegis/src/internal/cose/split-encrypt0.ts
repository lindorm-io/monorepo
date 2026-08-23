import { CweError } from "../../errors/index.js";
import { decodeCbor } from "./cbor.js";
import { requireBstr } from "./require-bstr.js";
import { requireCose } from "./require-cose.js";
import { COSE_TAG } from "./structures.js";

const MESSAGE = "Malformed COSE_Encrypt0";
const ARITY_DETAILS =
  "A COSE_Encrypt0 must be a 3-element array [protected, unprotected, ciphertext].";
const PROTECTED_DETAILS =
  "The COSE_Encrypt0 protected header slot is not a byte string, so its parameters cannot be read.";

/** The three wire segments of a COSE_Encrypt0 (RFC 9052 §5.2). */
export type Encrypt0Segments = {
  /** The protected header byte string — the AAD input, so it travels raw. */
  protectedBstr: Buffer;
  /**
   * The unprotected bucket AS CBOR DECODED IT. ⚠ `unknown` on purpose: nothing has
   * checked it is a map, and the two read paths answer that differently — `decode`
   * narrows with `instanceof Map`, `decrypt` reads the IV off the narrowed value.
   * Typing it as a `Map` would only move the unchecked assertion.
   */
  unprotected: unknown;
  /**
   * The ciphertext slot AS CBOR DECODED IT — `ciphertext ‖ tag` when it is bytes.
   * ⚠ `unknown` for the same reason as `unprotected`. RFC 9052 §5.2. `CweKit.decode`
   * keeps reading a nil one; `CweKit.decrypt` reaches the bytes through
   * `requireBstr`.
   */
  coseCiphertext: unknown;
};

/**
 * Decode a CWE token to the COSE_Encrypt0 segments, or refuse it. The outer CWT
 * tag is stripped, so an un-enveloped token reads too.
 *
 * The ONE opening `CweKit.decrypt` and `CweKit.decode` share. The IV read, the tag
 * split and the AEAD stay with `decrypt`, because `decode` must keep reading a
 * header-only COSE_Encrypt0 that carries neither.
 */
export const splitEncrypt0 = (token: Buffer): Encrypt0Segments => {
  const contents = requireCose(decodeCbor(token), {
    arity: { exactly: 3 },
    tags: [COSE_TAG.encrypt0],
    error: CweError,
    message: MESSAGE,
    title: MESSAGE,
    details: ARITY_DETAILS,
  });

  // The protected bucket is a bstr (RFC 9052 §3) on both read paths — `decode`
  // translates it and `decrypt` makes it the AAD. ⚠ `decodeProtectedHeader`
  // (`structures.ts`) judges the CBOR INSIDE the byte string and never the slot's
  // own type, so this is the only gate that can name a non-bstr slot 0 — and the
  // only one keeping it inside the `AegisError` contract.
  const protectedBstr = requireBstr(contents[0], {
    error: CweError,
    message: MESSAGE,
    title: MESSAGE,
    details: PROTECTED_DETAILS,
  });
  const [, unprotected, coseCiphertext] = contents;

  return { protectedBstr, unprotected, coseCiphertext };
};
