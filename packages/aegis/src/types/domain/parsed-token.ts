import type { Dict } from "@lindorm/types";
import type { VerifiedToken } from "./verified-token.js";

/**
 * The `aegis.parse` result — the keyless, UNVERIFIED domain read. Structurally a
 * {@link VerifiedToken} MINUS `dpop`: `dpop` is the ONLY verify-populated field (a
 * DPoP proof binding is a verify-time artefact), so it can never appear on a parse
 * result. Everything else is a pure unverified read of the wire — the domain-keyed
 * `claims`/`custom`/`profile`/`sensitive` buckets, the domain `header`, the
 * `format` discriminant, and `inner`/`contentType`/`raw`/`wire`/`token`.
 *
 * UNVERIFIED means there is NO signature guarantee: the claims are whatever the
 * wire carried and nothing here proves the token is authentic (use `aegis.verify`
 * for that). `delegation`, if present, is the EXTRACTED-but-unvalidated actor
 * chain — read straight off the `act` claim without validating the chain.
 */
export type ParsedToken<C extends Dict = Dict> = Omit<VerifiedToken<C>, "dpop">;
