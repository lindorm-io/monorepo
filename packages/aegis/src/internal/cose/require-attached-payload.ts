import type { CoseError } from "../../errors/index.js";

/**
 * Reach the ATTACHED payload bytes of a signed COSE structure, or refuse the
 * token with the structural `cose_malformed` verdict.
 *
 * `splitSigned` types its `payload` honestly as `Uint8Array | null | undefined`
 * because a DETACHED (nil) payload is legal COSE (RFC 9052 §4.1) — the decision
 * belongs to the call site, and none of aegis's read paths accept one: a claims
 * CWT with no claims is not a CWT, and the opaque signer has never carried the
 * detached bytes out of band. Every one of those sites used to cast the `null`
 * away and hand it to `Buffer.from`, which threw a raw `TypeError` — outside the
 * `AegisError` contract entirely, so a caller discriminating on it reported a
 * server fault for a token it should simply have rejected.
 *
 * The words differ per structure (a CWT and an opaque COSE_Sign1 are malformed
 * in different terms, under different leaf error classes), so they are DATA
 * here — exactly as in `requireCose` — and the code cannot drift.
 */
export const requireAttachedPayload = (
  payload: Uint8Array | null | undefined,
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
  if (payload != null) return Buffer.from(payload);

  throw new error(message, { code: "cose_malformed", title, details });
};
