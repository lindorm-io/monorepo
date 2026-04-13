import { ActClaim } from "./act-claim";

// Delegation claims — `act` and `may_act` from RFC 8693 §4.1
// (OAuth 2.0 Token Exchange). Together they describe the actor chain:
// `act` is the party currently acting on behalf of the subject, and
// `may_act` lists parties authorized to become the actor.
//
// The derived view of these claims lives in TokenDelegation
// (src/types/jwt/jwt-delegation.ts).
//
// https://datatracker.ietf.org/doc/html/rfc8693#section-4.1
export type DelegationClaims = {
  act?: ActClaim;
  mayAct?: ActClaim;
};
