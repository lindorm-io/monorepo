import type { CwtWireClaims } from "./cwt-wire-claims.js";

/**
 * A CWT carries its header in the COSE protected/unprotected maps — the same
 * alg / kid / typ triple as a raw COSE_Sign1. The COSE analogue of
 * `ParsedJwtHeader`.
 */
export type ParsedCwtHeader = {
  alg: string | undefined;
  kid: string | undefined;
  typ: string | undefined;
};

/**
 * The NATIVE WIRE result of verifying a generic CWT (`cwt.verify` / `cwm.verify`)
 * — the COSE analogue of the native `ParsedJwt`. `payload` is the COSE-name-keyed
 * WIRE claim map (`cti`/`exp`, temporal claims as `Date`s — NOT the domain
 * `tokenId`/`expiresAt`); the domain translation happens on the Aegis verify
 * surface (`aegis.verify`), never on this raw namespace.
 */
export type ParsedCwt<C extends CwtWireClaims = CwtWireClaims> = {
  header: ParsedCwtHeader;
  payload: C;
  token: string;
};
