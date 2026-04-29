import type { ConfirmationClaimWire } from "./confirmation-claim-wire.js";

// Wire form of PopClaims — RFC 7800 (Proof-of-Possession Key Semantics
// for JWTs). The `cnf` claim holds the proof key the token is bound to.
// Reused by RFC 9449 (DPoP, jkt field) and RFC 8705 (mTLS, x5t#S256 field).
//
// https://datatracker.ietf.org/doc/html/rfc7800
export type PopClaimsWire = {
  cnf?: ConfirmationClaimWire;
};
