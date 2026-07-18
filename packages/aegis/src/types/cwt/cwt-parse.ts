import type { Dict } from "@lindorm/types";

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
 * The result of verifying a generic CWT (`cwt.verify`) — the COSE analogue of
 * `ParsedJwt`. `claims` is the decoded DOMAIN-keyed claim map (issuer, subject,
 * audience, `expiresAt` as a `Date`, …), the same shape the verify floor and the
 * JWT parse consume.
 */
export type ParsedCwt<C extends Dict = Dict> = {
  claims: C;
  header: ParsedCwtHeader;
  token: string;
};
