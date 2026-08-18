import type { KryptosJwk } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";

// Public, camelCase representation of the RFC 7800 `cnf` claim.
//
// The wire counterpart is `ConfirmationClaimWire` (`../wire/confirmation-claim-wire.ts`).
// ⚠ The note that used to sit here said it was "consumed only by the wire<->public
// mapping layer in jwt-payload.ts", and BOTH halves were wrong: the path it gave
// was `./jwt/confirmation-claim-wire`, which has never existed, and
// `jwt-payload.ts` is not a file in this package at all. The mapping lives in
// `internal/claims/translate.ts`, driven by `internal/claims/cnf-members.ts`.
//
// ⚠⚠ THE MEMBER SET IS OPEN, AND THE RFC IS WHY. RFC 7800 §3.1: "Other members
// of the 'cnf' object may be defined because a proof-of-possession key may not be
// the only means of confirming the authenticity of the token." And: "in the
// absence of such requirements, all confirmation members that are not understood
// by implementations MUST be ignored." §6.2 establishes an IANA registry that
// other specifications register into — two of the five below arrived that way
// (`jkt`, RFC 9449 §6.1; `x5t#S256`, RFC 8705 §3.1) — and §6.2.2's own initial
// contents name a member aegis does not carry (`jwe`, §3.3). So refusing an
// undeclared member would refuse a conformant token, and aegis carries anything
// it does not declare VERBATIM: §6.2.1 makes a confirmation method name "case
// sensitive", so the house case flip would rewrite it.
//
// ⚠ ONE THING IS STILL REFUSED: a tail member whose key COLLIDES with a declared
// member's resolved key. Both would land on one key, and letting the last one win
// would hand the binding to whoever wrote the token. A declared member whose VALUE
// contradicts its shape is refused too — a binding the issuer stated and this
// package cannot read cannot be honoured, and dropping it would downgrade a
// sender-constrained token to a bearer one.
//
// https://datatracker.ietf.org/doc/html/rfc7800
// https://datatracker.ietf.org/doc/html/rfc9449#section-6 (jkt)
// https://datatracker.ietf.org/doc/html/rfc8705#section-3 (x5t#S256)

/**
 * The five members aegis DECLARES, split out from the open type on purpose —
 * exactly as `ActClaimMembers` is, and for the same reason: `keyof (X & Dict)` is
 * `string`, so a drift guard written over the open type would bind to nothing.
 */
export type ConfirmationClaimMembers = {
  thumbprint?: string; // wire: jkt — DPoP JWK thumbprint
  mtlsCertThumbprint?: string; // wire: x5t#S256 — mTLS client certificate thumbprint
  key?: KryptosJwk; // wire: jwk
  keyId?: string; // wire: kid
  jwkSetUri?: string; // wire: jku
};

export type ConfirmationClaim = ConfirmationClaimMembers & Dict;
