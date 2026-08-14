import type { CoseError } from "../../errors/index.js";

/**
 * Reach the signature (COSE_Sign1) or authentication tag (COSE_Mac0) bytes of a
 * signed COSE structure, or refuse the token with the structural
 * `cose_malformed` verdict. The twin of `requireAttachedPayload`, on the other
 * slot the same structure can leave nil.
 *
 * `arity: { exactly: 4 }` guarantees four ELEMENTS, never four non-nil ones: a
 * 4-element COSE_Sign1 carrying `null` in slot 4 is a legal CBOR structure that
 * clears the arity, kid, algorithm and crit gates. Every read path used to cast
 * that `null` away and hand it to `Buffer.from`, which throws a raw `TypeError`
 * — outside the `AegisError` contract entirely, so a caller discriminating on it
 * reported a server fault for a token it should simply have rejected.
 *
 * The words differ per structure (a CWT and an opaque COSE_Sign1 are malformed
 * in different terms, under different leaf error classes), so they are DATA
 * here — exactly as in `requireAttachedPayload` — and the code cannot drift.
 */
export const requireSignature = (
  signature: Uint8Array | null | undefined,
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
  if (signature != null) return Buffer.from(signature);

  throw new error(message, { code: "cose_malformed", title, details });
};
