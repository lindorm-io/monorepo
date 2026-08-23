import type { CoseError } from "../../errors/index.js";

/**
 * Reach a COSE byte-string slot, or refuse the token with the structural
 * `cose_malformed` verdict. RFC 9052 §3, RFC 9052 §4.2, RFC 9052 §5.2,
 * RFC 9052 §6.2.
 *
 * ⚠ TYPE ONLY, never length. `encodeProtectedHeader` (`structures.ts`) emits a
 * ZERO-LENGTH byte string for an empty header map, so a non-empty check would
 * refuse every aegis token carrying no protected parameter — pinned by
 * `require-bstr.test.ts`.
 *
 * ⚠ WHICH slots may be nil is a property of the CALL SITE, not of this guard: a
 * producer writes any CBOR type it likes into any slot, and `requireCose`'s arity
 * counts ELEMENTS, so an `int`, a `tstr` and `null` all clear it. A site that must
 * tolerate a nil slot — `CweKit.decode` on a detached ciphertext — does not read
 * those bytes and does not call this.
 *
 * The words differ per structure and per leaf error class, so they are DATA here
 * and the code cannot drift.
 */
export const requireBstr = (
  value: unknown,
  {
    error,
    message,
    title,
    details,
  }: {
    error: typeof CoseError;
    message: string;
    title: string;
    details: string;
  },
): Buffer => {
  if (value instanceof Uint8Array) return Buffer.from(value);

  throw new error(message, { code: "cose_malformed", title, details });
};
