import type { Dict } from "@lindorm/types";

/**
 * A COSE token carries its header in the COSE protected/unprotected maps, not a
 * JOSE segment, so the parsed header is the same alg / kid / typ triple read off
 * the CWT — the COSE analogue of `ParsedJwsHeader`.
 */
export type ParsedCwsHeader = {
  alg: string | undefined;
  kid: string | undefined;
  typ: string | undefined;
};

/**
 * The result of verifying a raw COSE_Sign1 (`cws.verify`) — the COSE analogue of
 * `ParsedJws`. A COSE payload is a CBOR claims map, so `claims` is the decoded
 * domain-keyed map rather than an opaque `payload` byte string.
 */
export type ParsedCws<T extends Dict = Dict> = {
  claims: T;
  header: ParsedCwsHeader;
  token: string;
};
