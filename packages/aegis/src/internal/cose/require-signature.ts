import type { CoseError } from "../../errors/index.js";

/**
 * Reach the signature or authentication tag bytes of a signed COSE structure, or
 * refuse the token with the structural `cose_malformed` verdict. The twin of
 * `requireAttachedPayload`, on the other slot the same structure can leave nil.
 *
 * ⚠ `arity: { exactly: 4 }` guarantees four ELEMENTS, never four non-nil ones, so
 * `null` in slot 4 clears the arity, kid, algorithm and crit gates. Casting it
 * away and handing it to `Buffer.from` throws a raw `TypeError` outside the
 * `AegisError` contract, so a caller discriminating on it reports a server fault
 * for a token it should have rejected.
 *
 * The words differ per structure and per leaf error class, so they are DATA here
 * and the code cannot drift.
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
