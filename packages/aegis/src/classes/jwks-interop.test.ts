import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createLocalJWKSet, importJWK, jwtVerify } from "jose";
import { describe, expect, test } from "vitest";
import { JwtKit } from "./JwtKit.js";
import { defaultProfile } from "../internal/profiles/definitions/default.js";
import { buildProfileClaims } from "../internal/utils/build-profile-claims.js";
import {
  computeTypHeader,
  extractTypPrefix,
} from "../internal/utils/compute-typ-header.js";
import type { SignContent } from "../types/index.js";

// The FOREIGN-CLIENT BOUNDARY. Every other suite we own verifies lindorm tokens
// with lindorm code, which never round-trips a JWK through WebCrypto's key-usage
// validation — so it cannot see a malformed `key_ops`. The existing
// `jwt-interop` suite hands jose `kryptos.export("jwk")`, which is a different
// export surface that never carried `key_ops` at all.
//
// This suite uses the surface we actually PUBLISH — `toJWK("public")`, exactly
// as amphora's JWKS route builds it — and imports it with real `jose` (built on
// WebCrypto). WebCrypto passes `key_ops` through to `importKey()` as `keyUsages`
// and HARD THROWS on a public key that claims a private operation, so a public
// JWK carrying `key_ops: ["sign","verify"]` is unimportable by any mainstream RP
// and nobody could verify a token we issue. Reintroduce `key_ops` on the public
// export and these tests go red.

const ISSUER = "https://interop.test.lindorm.io/";
const SUBJECT = "d4e5f6a7-b8c9-4d0e-1a2b-3c4d5e6f7890";
const logger = createMockLogger();

const signDefault = (kit: JwtKit, content: SignContent) => {
  const claims = buildProfileClaims(
    { algorithm: kit.algorithm, issuer: ISSUER },
    defaultProfile,
    content,
  );
  return kit.sign(claims, {
    tokenType: extractTypPrefix(computeTypHeader(content.tokenType, "jwt")),
  });
};

// Exactly how amphora assembles the published JWKS (Amphora.refreshJwks).
const publishedJwks = (...keys: Array<{ toJWK: (mode: "public") => unknown }>) => ({
  keys: keys.map((key) => key.toJWK("public")) as Array<Record<string, unknown>>,
});

describe("JWKS interop: published JWKS <-> jose (WebCrypto)", () => {
  describe.each([
    { name: "EC / ES256", algorithm: "ES256" as const },
    { name: "RSA / RS256", algorithm: "RS256" as const },
    { name: "OKP / EdDSA", algorithm: "EdDSA" as const },
  ])("$name", ({ algorithm }) => {
    test("a foreign RP verifies an aegis token against our published JWKS", async () => {
      const kryptos = KryptosKit.generate.auto({ algorithm });
      const kit = new JwtKit({ logger, kryptos });

      const token = signDefault(kit, {
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
      });

      // The RP fetches /.well-known/jwks.json and imports it. This is where a
      // public key claiming `sign` would blow up.
      const jwks = createLocalJWKSet(publishedJwks(kryptos) as never);

      const result = await jwtVerify(token, jwks);

      expect(result.payload.iss).toBe(ISSUER);
      expect(result.payload.sub).toBe(SUBJECT);
      expect(result.protectedHeader.kid).toBe(kryptos.id);
    });

    test("the published public JWK omits key_ops and imports cleanly", async () => {
      const kryptos = KryptosKit.generate.auto({ algorithm });

      const jwk = kryptos.toJWK("public");

      expect("key_ops" in jwk).toBe(false);
      await expect(importJWK(jwk as never, algorithm)).resolves.toBeDefined();
    });
  });

  // The enc case is the reason we OMIT rather than emit a corrected subset:
  // WebCrypto gives a *public* ECDH key no usages at all (they live on the
  // private half), so ANY key_ops we emitted for it — even `["deriveKey"]` —
  // would throw. There is no correct subset.
  describe.each([
    { name: "EC / ECDH-ES+A256KW", algorithm: "ECDH-ES+A256KW" as const },
    { name: "RSA / RSA-OAEP-256", algorithm: "RSA-OAEP-256" as const },
  ])("$name (enc)", ({ algorithm }) => {
    test("the published public enc JWK omits key_ops and imports cleanly", async () => {
      const kryptos = KryptosKit.generate.auto({
        algorithm,
        encryption: "A256GCM",
      });

      const jwk = kryptos.toJWK("public");

      expect("key_ops" in jwk).toBe(false);
      expect(jwk.use).toBe("enc");
      await expect(importJWK(jwk as never, algorithm)).resolves.toBeDefined();
    });
  });

  test("a multi-key JWKS resolves the right key by kid", async () => {
    const signing = KryptosKit.generate.auto({ algorithm: "ES256" });
    const other = KryptosKit.generate.auto({ algorithm: "RS256" });
    const kit = new JwtKit({ logger, kryptos: signing });

    const token = signDefault(kit, {
      expires: "1h",
      subject: SUBJECT,
      tokenType: "access_token",
    });

    const jwks = createLocalJWKSet(publishedJwks(other, signing) as never);

    const result = await jwtVerify(token, jwks);

    expect(result.payload.sub).toBe(SUBJECT);
    expect(result.protectedHeader.kid).toBe(signing.id);
  });

  // Guards the exact regression: a public JWK that names a private operation is
  // rejected by WebCrypto. If this ever stops throwing, the omission above has
  // become load-bearing for the wrong reason and the assertions must be revisited.
  test("WebCrypto rejects a public JWK that claims a private operation", async () => {
    const kryptos = KryptosKit.generate.auto({ algorithm: "ES256" });

    const poisoned = { ...kryptos.toJWK("public"), key_ops: ["sign", "verify"] };

    await expect(importJWK(poisoned as never, "ES256")).rejects.toThrow(
      /Unsupported key usage/i,
    );
  });
});
