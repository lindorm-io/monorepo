import { type KryptosEncryption, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { CompactEncrypt, compactDecrypt, importJWK } from "jose";
import { JweKit } from "./JweKit.js";
import { describe, expect, test } from "vitest";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const PLAINTEXT = "hello aegis jwe interop";
const logger = createMockLogger();

// ---------------------------------------------------------------------------
// Key generation helpers
// ---------------------------------------------------------------------------

// The KEY carries the content encryption — the kit honours the declaration
// rather than overriding it — so every helper takes the AEAD the case exercises.
const createOctKwKey = (encryption: KryptosEncryption) =>
  KryptosKit.generate.enc.oct({ algorithm: "A128KW", encryption });

const createOctDirKey = (encryption: "A256GCM" | "A128GCM" = "A256GCM") =>
  KryptosKit.generate.enc.oct({ algorithm: "dir", encryption });

const createRsaOaepKey = (encryption: KryptosEncryption) =>
  KryptosKit.generate.enc.rsa({ algorithm: "RSA-OAEP-256", encryption });

const createEcdhEsKey = (encryption: KryptosEncryption) =>
  KryptosKit.generate.enc.ec({ algorithm: "ECDH-ES", curve: "P-256", encryption });

// ---------------------------------------------------------------------------
// Helper: export public-only JWK for jose encryption
// ---------------------------------------------------------------------------

const toPublicJwk = (jwk: Record<string, unknown>): Record<string, unknown> => {
  const { d, dp, dq, p, q, qi, ...publicParts } = jwk as any;
  return publicParts;
};

// ---------------------------------------------------------------------------
// A128KW + A128GCM
// ---------------------------------------------------------------------------

describe("JWE interop: aegis <-> jose", () => {
  describe("A128KW + A128GCM", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createOctKwKey("A128GCM");
      const kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.alg).toBe("A128KW");
      expect(result.protectedHeader.enc).toBe("A128GCM");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createOctKwKey("A128GCM");
      const kit = new JweKit({ logger, kryptos });

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const token = await new CompactEncrypt(new TextEncoder().encode(PLAINTEXT))
        .setProtectedHeader({
          alg: "A128KW",
          enc: "A128GCM",
          typ: "JWE",
          kid: kryptos.id,
          cty: "text/plain; charset=utf-8",
        })
        .encrypt(joseKey);

      const result = kit.decrypt(token);

      expect(result.payload).toBe(PLAINTEXT);
      expect(result.header.alg).toBe("A128KW");
      expect(result.header.enc).toBe("A128GCM");
    });
  });

  // ---------------------------------------------------------------------------
  // A128KW + A256GCM
  // ---------------------------------------------------------------------------

  describe("A128KW + A256GCM", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createOctKwKey("A256GCM");
      const kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createOctKwKey("A256GCM");
      const kit = new JweKit({ logger, kryptos });

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const token = await new CompactEncrypt(new TextEncoder().encode(PLAINTEXT))
        .setProtectedHeader({
          alg: "A128KW",
          enc: "A256GCM",
          typ: "JWE",
          kid: kryptos.id,
          cty: "text/plain; charset=utf-8",
        })
        .encrypt(joseKey);

      const result = kit.decrypt(token);

      expect(result.payload).toBe(PLAINTEXT);
    });
  });

  // ---------------------------------------------------------------------------
  // RSA-OAEP-256 + A256GCM
  // ---------------------------------------------------------------------------

  describe("RSA-OAEP-256 + A256GCM", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createRsaOaepKey("A256GCM");
      const kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt(PLAINTEXT);

      // jose needs private key for RSA decryption
      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "RSA-OAEP-256");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.alg).toBe("RSA-OAEP-256");
      expect(result.protectedHeader.enc).toBe("A256GCM");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createRsaOaepKey("A256GCM");
      const kit = new JweKit({ logger, kryptos });

      // jose encrypts with public key
      const jwk = kryptos.export("jwk");
      const publicJwk = toPublicJwk(jwk);
      const joseKey = await importJWK(publicJwk, "RSA-OAEP-256");

      const token = await new CompactEncrypt(new TextEncoder().encode(PLAINTEXT))
        .setProtectedHeader({
          alg: "RSA-OAEP-256",
          enc: "A256GCM",
          typ: "JWE",
          kid: kryptos.id,
          cty: "text/plain; charset=utf-8",
        })
        .encrypt(joseKey);

      const result = kit.decrypt(token);

      expect(result.payload).toBe(PLAINTEXT);
      expect(result.header.alg).toBe("RSA-OAEP-256");
      expect(result.header.enc).toBe("A256GCM");
    });
  });

  // ---------------------------------------------------------------------------
  // RSA-OAEP-256 + A128CBC-HS256
  // ---------------------------------------------------------------------------

  describe("RSA-OAEP-256 + A128CBC-HS256", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createRsaOaepKey("A128CBC-HS256");
      const kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "RSA-OAEP-256");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.enc).toBe("A128CBC-HS256");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createRsaOaepKey("A128CBC-HS256");
      const kit = new JweKit({ logger, kryptos });

      const jwk = kryptos.export("jwk");
      const publicJwk = toPublicJwk(jwk);
      const joseKey = await importJWK(publicJwk, "RSA-OAEP-256");

      const token = await new CompactEncrypt(new TextEncoder().encode(PLAINTEXT))
        .setProtectedHeader({
          alg: "RSA-OAEP-256",
          enc: "A128CBC-HS256",
          typ: "JWE",
          kid: kryptos.id,
          cty: "text/plain; charset=utf-8",
        })
        .encrypt(joseKey);

      const result = kit.decrypt(token);

      expect(result.payload).toBe(PLAINTEXT);
      expect(result.header.enc).toBe("A128CBC-HS256");
    });
  });

  // ---------------------------------------------------------------------------
  // A128KW + A128CBC-HS256
  // ---------------------------------------------------------------------------

  describe("A128KW + A128CBC-HS256", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createOctKwKey("A128CBC-HS256");
      const kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.enc).toBe("A128CBC-HS256");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createOctKwKey("A128CBC-HS256");
      const kit = new JweKit({ logger, kryptos });

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const token = await new CompactEncrypt(new TextEncoder().encode(PLAINTEXT))
        .setProtectedHeader({
          alg: "A128KW",
          enc: "A128CBC-HS256",
          typ: "JWE",
          kid: kryptos.id,
          cty: "text/plain; charset=utf-8",
        })
        .encrypt(joseKey);

      const result = kit.decrypt(token);

      expect(result.payload).toBe(PLAINTEXT);
      expect(result.header.enc).toBe("A128CBC-HS256");
    });
  });

  // ---------------------------------------------------------------------------
  // dir + A256GCM
  // ---------------------------------------------------------------------------

  describe("dir + A256GCM", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createOctDirKey("A256GCM");
      const kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "dir");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.alg).toBe("dir");
      expect(result.protectedHeader.enc).toBe("A256GCM");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createOctDirKey("A256GCM");
      const kit = new JweKit({ logger, kryptos });

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "dir");

      const token = await new CompactEncrypt(new TextEncoder().encode(PLAINTEXT))
        .setProtectedHeader({
          alg: "dir",
          enc: "A256GCM",
          typ: "JWE",
          kid: kryptos.id,
          cty: "text/plain; charset=utf-8",
        })
        .encrypt(joseKey);

      const result = kit.decrypt(token);

      expect(result.payload).toBe(PLAINTEXT);
      expect(result.header.alg).toBe("dir");
      expect(result.header.enc).toBe("A256GCM");
    });
  });

  // ---------------------------------------------------------------------------
  // ECDH-ES + A256GCM (EC P-256)
  // ---------------------------------------------------------------------------

  describe("ECDH-ES + A256GCM", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createEcdhEsKey("A256GCM");
      const kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt(PLAINTEXT);

      // jose needs private key for ECDH-ES decryption
      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "ECDH-ES");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.alg).toBe("ECDH-ES");
      expect(result.protectedHeader.enc).toBe("A256GCM");
    });
  });
});
