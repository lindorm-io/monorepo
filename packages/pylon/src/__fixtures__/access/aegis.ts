import { Aegis, type IAegis } from "@lindorm/aegis";
import { Amphora } from "@lindorm/amphora";
import { KryptosKit } from "@lindorm/kryptos";
import type { ILogger } from "@lindorm/logger";

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
