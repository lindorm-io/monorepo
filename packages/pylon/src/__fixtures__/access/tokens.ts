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
 * An OPAQUE access token in its simplest form: a bare handle that is not a token
 * wire at all, so `aegis.verify` would refuse it with `unsupported_token_type`.
 * The middleware must introspect it instead.
 *
 * ⚠ Opaqueness is a property of the CLAIMS LAYER, not of the wire shape — an
 * authorization server's handle is routinely a SIGNED token (a JWS, or its COSE
 * twin a CWS) whose payload is the handle itself. Such a credential is dotted or
 * base64url CBOR and verifies its own signature, and is still opaque. Use
 * `mintOpaqueCws` (`__fixtures__/access/aegis.ts`) for that case; this constant
 * only covers the trivial one.
 */
export const OPAQUE_TOKEN = "opaque-access-token";
