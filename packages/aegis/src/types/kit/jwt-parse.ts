import type { Dict } from "@lindorm/types";
import type { SignedJoseHeader } from "../header/header.js";
import type { DecodedJwt } from "./jwt-decode.js";
import type { JwtWireClaims } from "../claims/wire/jwt-wire-claims.js";

/**
 * The raw JWT namespace (`aegis.jwt.verify`) result — the NATIVE WIRE shape
 * (Phase 19). It carries a WIRE-keyed `.payload` (`sub`/`exp`/`jti`, never the
 * domain `subject`/`expiresAt`/`tokenId`), the decoded segments, the DOMAIN-named
 * header (mirrors `ParsedJws`), and the token — exactly what a standalone JOSE
 * library returns. The domain claim translation + delegation/dpop enrichment
 * happen Aegis-side; the DOMAIN result (`aegis.verify` → `.claims`/`.custom`) is
 * the separate `VerifiedToken`.
 */
export type ParsedJwt<C extends Dict = Dict> = {
  decoded: DecodedJwt<C>;
  header: SignedJoseHeader;
  payload: JwtWireClaims & C;
  token: string;
};
