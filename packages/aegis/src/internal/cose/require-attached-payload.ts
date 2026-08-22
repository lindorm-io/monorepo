import type { CoseError } from "../../errors/index.js";

/**
 * Reach the ATTACHED payload bytes of a signed COSE structure, or refuse the token
 * with the structural `cose_malformed` verdict.
 *
 * `splitSigned` types its `payload` as `Uint8Array | null | undefined` because a
 * DETACHED payload is legal COSE (RFC 9052 §4.1) — but no aegis read path accepts
 * one, since a claims CWT with no claims is not a CWT and the opaque signer never
 * carries the bytes out of band. ⚠ Casting the `null` away and handing it to
 * `Buffer.from` throws a raw `TypeError` outside the `AegisError` contract, so a
 * caller discriminating on it reports a server fault for a token it should have
 * rejected.
 *
 * The words differ per structure and per leaf error class, so they are DATA here
 * and the code cannot drift.
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
