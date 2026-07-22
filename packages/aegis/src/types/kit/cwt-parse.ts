import type { ParsedCoseHeader } from "./cws-parse.js";
import type { CwtWireClaims } from "../claims/wire/cwt-wire-claims.js";

/**
 * The NATIVE WIRE result of verifying a generic CWT (`cwt.verify` / `cwm.verify`)
 * — the COSE analogue of the native `ParsedJwt`. `payload` is the COSE-name-keyed
 * WIRE claim map (`cti`/`exp`, temporal claims as `Date`s — NOT the domain
 * `tokenId`/`expiresAt`); the domain translation happens on the Aegis verify
 * surface (`aegis.verify`), never on this raw namespace.
 */
export type ParsedCwt<C extends CwtWireClaims = CwtWireClaims> = {
  header: ParsedCoseHeader;
  payload: C;
  token: string;
};
