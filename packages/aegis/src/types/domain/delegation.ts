import type { ActClaim } from "../claims/domain/act-claim.js";

// Delegation summary derived from the token's `act` claim chain.
// Subject lives on the payload (payload.subject). This type focuses
// purely on "how is the token being used" — the actor chain and its state.
export type TokenDelegation = {
  currentActor: string | undefined;
  actorChain: Array<ActClaim>;
  isDelegated: boolean;
};

// Parsed representation of a verified RFC 9449 DPoP proof JWT.
// Populated on the outer ParsedJwt wrapper when the verifier is given a
// `dpopProof` input. Request-context fields (`httpMethod`, `httpUri`) are
// parsed from the proof but NOT compared against the HTTP request by
// aegis — that comparison is the consumer's responsibility (pylon does
// it at the middleware layer).
//
// https://datatracker.ietf.org/doc/html/rfc9449
export type ParsedDpopProof = {
  thumbprint: string; // RFC 7638 thumbprint of the proof's header jwk
  tokenId: string; // proof jti
  httpMethod: string; // htm
  httpUri: string; // htu
  issuedAt: Date; // iat
  accessTokenHash?: string; // ath
  nonce?: string;
};
