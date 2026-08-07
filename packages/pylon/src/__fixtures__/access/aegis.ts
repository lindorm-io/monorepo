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

  return new Aegis({ amphora, issuer: ACCESS_TEST_ISSUER, logger });
};

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
