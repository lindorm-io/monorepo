import type { DomainClaims } from "@lindorm/aegis";
import type { UseAccessTokenOptions } from "../../middleware/common/use-access-token.js";
import type { PylonIntrospectionActive } from "../../types/index.js";

/**
 * The resource server's own identity — what a mount declares as its `audience`
 * and what a credential must carry in `aud` (RFC 9068 §4). Required on every
 * `useAccessToken` mount, so it is stated once here.
 */
export const ACCESS_TEST_AUDIENCE = "https://api.test.lindorm.io";

/** The issuer `createTestAuthConfig` settles by default. */
export const ACCESS_TEST_APP_ISSUER = "https://test.lindorm.io/";

/** The mount options for a suite whose subject is NOT the claim matchers. */
export const ACCESS_MOUNT: UseAccessTokenOptions = { audience: ACCESS_TEST_AUDIENCE };

/**
 * The claim floor a resolved credential must clear on BOTH arms: the issuer this
 * deployment pinned and an `aud` containing the mount's own identity. A mocked
 * credential missing either is rejected — which is the point, so tests state
 * them rather than relying on a lenient assert.
 */
export const accessClaims = (overrides: Partial<DomainClaims> = {}): DomainClaims => ({
  issuer: ACCESS_TEST_APP_ISSUER,
  audience: [ACCESS_TEST_AUDIENCE],
  subject: "alice",
  ...overrides,
});

/** The `aegis.verify` answer for a structured credential that clears the floor. */
export const verifiedAccess = (
  overrides: Partial<DomainClaims> = {},
  token: string = joseShapedToken(),
) => ({
  claims: accessClaims(overrides),
  custom: {},
  format: "jwt" as const,
  header: { tokenType: "access_token" as const },
  token,
});

/**
 * An RFC 7662 answer that clears the floor. `tokenType` is present because the
 * introspected arm now requires the authority to state it — a bare
 * `{ active: true }` is refused.
 */
export const introspectionAnswer = (
  overrides: Partial<PylonIntrospectionActive> = {},
): PylonIntrospectionActive => ({
  active: true,
  custom: {},
  tokenType: "Bearer",
  ...accessClaims(),
  ...overrides,
});

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
