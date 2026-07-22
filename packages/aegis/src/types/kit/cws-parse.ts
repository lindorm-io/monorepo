/**
 * A COSE token carries its header in the COSE protected/unprotected maps, not a
 * JOSE segment, so the parsed header is the alg / kid / typ triple read off the
 * COSE structure. Shared by both COSE parse results — the opaque `ParsedCws` and
 * the claims-bearing `ParsedCwt` — the COSE analogue of `SignedJoseHeader`.
 */
export type ParsedCoseHeader = {
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
  header: ParsedCoseHeader;
  raw: Buffer;
  token: string;
};
