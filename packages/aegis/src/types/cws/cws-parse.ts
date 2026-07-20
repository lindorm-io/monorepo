/**
 * A COSE token carries its header in the COSE protected/unprotected maps, not a
 * JOSE segment, so the parsed header is the same alg / kid / typ triple read off
 * the CWS — the COSE analogue of `ParsedJwsHeader`.
 */
export type ParsedCwsHeader = {
  alg: string | undefined;
  kid: string | undefined;
  typ: string | undefined;
};

/**
 * The result of verifying an OPAQUE COSE_Sign1 / COSE_Mac0 (`cws.verify`) — the
 * COSE analogue of `ParsedJws`. A CWS carries no claims layer, so its verified
 * payload is delivered as an opaque `raw` byte buffer (the CBOR bytes the signer
 * secured), NOT a decoded claim map. A claim-bearing COSE token is a CWT (`cwt`).
 */
export type ParsedCws = {
  header: ParsedCwsHeader;
  raw: Buffer;
  token: string;
};
