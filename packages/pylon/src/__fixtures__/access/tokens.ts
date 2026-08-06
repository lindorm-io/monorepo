const segment = (value: object): string =>
  Buffer.from(JSON.stringify(value)).toString("base64url");

/**
 * A JOSE-SHAPED access token: three segments and a decodable `{ alg, typ: "JWT" }`
 * header, which is exactly what `Aegis.isJose` reads. Nothing is signed — these
 * fixtures exercise the middleware's FORMAT sniff with a mocked aegis; the real
 * signature path is covered where a real Aegis is constructed.
 */
export const joseShapedToken = (payload: object = { sub: "alice" }): string =>
  [segment({ alg: "RS256", typ: "JWT" }), segment(payload), "signature"].join(".");

/**
 * An OPAQUE access token — not dot-delimited and not base64url CBOR, so neither
 * `Aegis.isJose` nor `Aegis.isCose` accepts it and `aegis.verify` would refuse it
 * with `unsupported_token_type`. The middleware must introspect it instead.
 */
export const OPAQUE_TOKEN = "opaque-access-token";
