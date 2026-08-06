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
// Populated on the domain `VerifiedToken` wrapper when the verifier is given a
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

/**
 * Args for the STANDALONE proof verifier (`Aegis.verifyDpopProof`) — the same
 * checks `aegis.verify` runs when handed a `dpopProof`, exposed on their own so a
 * resource server can validate a proof against a token it did NOT verify locally.
 * RFC 9449 §6.2 makes that the normal case for an opaque access token: the
 * thumbprint arrives as `cnf.jkt` in the introspection response, and "the resource
 * server uses the data of the introspection response to validate the access token
 * binding itself locally".
 */
export type VerifyDpopProofOptions = {
  /** The compact JWS from the request's `DPoP` header. */
  proof: string;
  /** The presented access token — the `ath` claim must hash to it (RFC 9449 §7). */
  accessToken: string;
  /** The token's bound key: `cnf.jkt` (domain: `confirmation.thumbprint`). */
  expectedThumbprint: string;
  /** Allowed `iat` skew in seconds. Defaults to the Aegis default (60). */
  dpopMaxSkew?: number;
};
