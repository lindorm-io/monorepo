import { Aegis, type IAegis, type ProfileMintOptions } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import { ACCESS_TEST_AUDIENCE } from "./tokens.js";

export const ACCESS_TEST_ISSUER = "http://access.test.lindorm.io";

/**
 * A REAL Aegis over a real, locally generated ES256 key — the only way to prove
 * that a tampered token actually fails signature verification. A mocked aegis
 * would answer whatever the test told it to.
 */
export const createTestAegis = (logger: ILogger): IAegis => {
  const amphora = new Amphora({ internal: { issuer: ACCESS_TEST_ISSUER }, logger });

  amphora.add(
    KryptosKit.generate.sig.ec({
      algorithm: "ES256",
      issuer: ACCESS_TEST_ISSUER,
      publish: true,
      purpose: "token",
    }),
  );

  // A recipient key so the sign-then-encrypt wire (JWE) is mintable here — the
  // format sniff has to route an encrypted CLAIMS token to local verification.
  amphora.add(
    KryptosKit.generate.enc.ec({
      algorithm: "ECDH-ES",
      issuer: ACCESS_TEST_ISSUER,
      publish: true,
      purpose: "token",
    }),
  );

  return new Aegis({ amphora, issuer: ACCESS_TEST_ISSUER, logger });
};

/**
 * Mint a REAL access token under the `access_token` profile (RFC 9068) — the
 * only thing `useAccessToken` verifies, so a test token must be one. The profile
 * floor demands `typ: application/at+jwt`, a URI issuer, exactly one resource
 * `aud`, and a present `client_id`/`jti`/`iat`/`exp`; the last three are
 * auto-injected at mint.
 *
 * `format: "cwt"` mints the COSE twin, whose floor typ is `application/at+cwt`.
 */
export const mintTestAccessToken = async (
  aegis: IAegis,
  content: Dict = {},
  options: ProfileMintOptions = {},
): Promise<string> =>
  (
    await aegis.mint(
      "access_token",
      {
        audience: [ACCESS_TEST_AUDIENCE],
        clientId: "client-a",
        subject: "alice",
        ...content,
      },
      options,
    )
  ).token;

/**
 * A THIRD-PARTY-shaped access token — bare `typ: JWT`, SEVERAL audiences and no
 * `client_id`, which is what an authorization server that does not follow RFC
 * 9068 §2.2 routinely emits. All three are refused by the strict `access_token`
 * profile, and all three are what `external_access_token` exists to accept.
 *
 * Signed through `aegis.jwt.sign`, which is POLICY-FREE: it serializes the wire
 * claims verbatim and injects no envelope (`iat`/`jti`/`iss`), so the token's
 * SHAPE is the third party's. Only the KEY is ours, so the signature resolves —
 * a test cannot hold another issuer's private key, and the shape is what is
 * under test.
 */
export const mintExternalAccessToken = async (
  aegis: IAegis,
  claims: Dict = {},
): Promise<string> => {
  const issuedAt = Math.floor(Date.now() / 1000);

  return (
    await aegis.jwt.sign({
      iss: ACCESS_TEST_ISSUER,
      sub: "alice",
      aud: [ACCESS_TEST_AUDIENCE, "account"],
      iat: issuedAt,
      exp: issuedAt + 3600,
      jti: "external-token-1",
      scope: "openid profile",
      ...claims,
    })
  ).token;
};

/**
 * A REAL, WELL-FORMED id_token, minted under aegis's own `id_token` profile —
 * the credential-confusion candidate. It carries `typ: JWT` (OIDC Core §2), the
 * `nonce` an authorization-code flow binds it to, and an explicit `jti`, so it
 * clears every `external_access_token` floor check except the one that matters.
 *
 * `audience` defaults to the RESOURCE SERVER rather than the client, which is
 * deliberately wrong for an id_token: it defeats the mount's audience check on
 * purpose, leaving the profile's `forbidden` list as the only thing between it
 * and acceptance.
 */
export const mintTestIdToken = async (
  aegis: IAegis,
  content: Dict = {},
): Promise<string> =>
  (
    await aegis.mint(
      "id_token",
      {
        audience: [ACCESS_TEST_AUDIENCE],
        nonce: "n-0S6_WzA2Mj",
        subject: "alice",
        ...content,
      },
      { sign: { tokenId: "id-token-1" } },
    )
  ).token;

/**
 * A REAL opaque handle that IS a valid COSE token: a signed COSE_Sign1 over an
 * opaque payload, stamped with the `+cws` media type — no claims layer at all.
 * This is the shape an authorization server's opaque access-token handle has by
 * construction, and the reason opaqueness cannot be sniffed from the WIRE
 * FAMILY: the token is structurally COSE, and aegis can even check its
 * signature, but only the authorization server can say anything about it.
 */
export const mintOpaqueCws = async (aegis: IAegis): Promise<string> =>
  (await aegis.cws.sign(Buffer.from("opaque-handle"))).token;

/**
 * Replace a compact JWS payload segment while keeping header and signature —
 * the classic tamper. The header stays a valid JOSE header, so the format sniff
 * still routes it to local verification; the signature no longer covers the
 * payload, so verification must fail.
 */
export const tamperPayload = (token: string, claims: object): string => {
  const [header, , signature] = token.split(".");
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");

  return [header, payload, signature].join(".");
};
