import type { ConfirmationClaim } from "./confirmation-claim.js";

// RFC 7800 — Proof-of-Possession Key Semantics for JWTs.
// Used by RFC 9449 (DPoP), RFC 8705 (mTLS), and other PoP profiles.
//
// https://datatracker.ietf.org/doc/html/rfc7800
export type PopClaims = {
  confirmation?: ConfirmationClaim;
};
