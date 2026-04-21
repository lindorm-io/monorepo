import type { ActClaimWire } from "./act-claim-wire.js";

// Wire form of DelegationClaims — RFC 8693 §4.1 (OAuth 2.0 Token Exchange).
// `act` and `may_act` describe the actor chain on the token.
//
// https://datatracker.ietf.org/doc/html/rfc8693#section-4.1
export type DelegationClaimsWire = {
  act?: ActClaimWire;
  may_act?: ActClaimWire;
};
