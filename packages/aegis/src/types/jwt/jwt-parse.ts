import type { KryptosSigAlgorithm } from "@lindorm/kryptos";
import type { Dict } from "@lindorm/types";
import type { RefinedDomainTokenHeader } from "../header.js";
import type { ParsedJwtWire } from "./jwt-wire.js";

export type ParsedJwtHeader = RefinedDomainTokenHeader<KryptosSigAlgorithm>;

/**
 * The raw JWT namespace (`aegis.jwt.verify`) result — the NATIVE WIRE shape
 * (Phase 19). It carries a WIRE-keyed `.payload` (`sub`/`exp`/`jti`, never the
 * domain `subject`/`expiresAt`/`tokenId`), the decoded segments, the header, and
 * the token — exactly what a standalone JOSE library returns. The DOMAIN result
 * (`aegis.verify` → `.claims`/`.custom`) is the separate `VerifiedToken`. So
 * `ParsedJwt` is an alias of {@link ParsedJwtWire}.
 */
export type ParsedJwt<C extends Dict = Dict> = ParsedJwtWire<C>;
