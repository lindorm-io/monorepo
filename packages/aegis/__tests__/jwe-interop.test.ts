import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger";
import { CompactEncrypt, compactDecrypt, importJWK } from "jose";
import { JweKit } from "../src/classes/JweKit";

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const PLAINTEXT = "hello aegis jwe interop";
const logger = createMockLogger();

// ---------------------------------------------------------------------------
// Key generation helpers
// ---------------------------------------------------------------------------

const createOctKwKey = () => KryptosKit.generate.enc.oct({ algorithm: "A128KW" });

const createOctDirKey = (encryption: "A256GCM" | "A128GCM" = "A256GCM") =>
  KryptosKit.generate.enc.oct({ algorithm: "dir", encryption });

const createRsaOaepKey = () => KryptosKit.generate.enc.rsa({ algorithm: "RSA-OAEP-256" });

const createEcdhEsKey = () =>
  KryptosKit.generate.enc.ec({ algorithm: "ECDH-ES", curve: "P-256" });

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
      const kryptos = createOctKwKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A128GCM" });

      const { token } = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.alg).toBe("A128KW");
      expect(result.protectedHeader.enc).toBe("A128GCM");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createOctKwKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A128GCM" });

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
      expect(result.header.algorithm).toBe("A128KW");
      expect(result.header.encryption).toBe("A128GCM");
    });
  });

  // ---------------------------------------------------------------------------
  // A128KW + A256GCM
  // ---------------------------------------------------------------------------

  describe("A128KW + A256GCM", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createOctKwKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A256GCM" });

      const { token } = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createOctKwKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A256GCM" });

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
      const kryptos = createRsaOaepKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A256GCM" });

      const { token } = kit.encrypt(PLAINTEXT);

      // jose needs private key for RSA decryption
      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "RSA-OAEP-256");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.alg).toBe("RSA-OAEP-256");
      expect(result.protectedHeader.enc).toBe("A256GCM");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createRsaOaepKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A256GCM" });

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
      expect(result.header.algorithm).toBe("RSA-OAEP-256");
      expect(result.header.encryption).toBe("A256GCM");
    });
  });

  // ---------------------------------------------------------------------------
  // RSA-OAEP-256 + A128CBC-HS256
  // ---------------------------------------------------------------------------

  describe("RSA-OAEP-256 + A128CBC-HS256", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createRsaOaepKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A128CBC-HS256" });

      const { token } = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "RSA-OAEP-256");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.enc).toBe("A128CBC-HS256");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createRsaOaepKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A128CBC-HS256" });

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
      expect(result.header.encryption).toBe("A128CBC-HS256");
    });
  });

  // ---------------------------------------------------------------------------
  // A128KW + A128CBC-HS256
  // ---------------------------------------------------------------------------

  describe("A128KW + A128CBC-HS256", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createOctKwKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A128CBC-HS256" });

      const { token } = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "A128KW");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.enc).toBe("A128CBC-HS256");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createOctKwKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A128CBC-HS256" });

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
      expect(result.header.encryption).toBe("A128CBC-HS256");
    });
  });

  // ---------------------------------------------------------------------------
  // dir + A256GCM
  // ---------------------------------------------------------------------------

  describe("dir + A256GCM", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createOctDirKey("A256GCM");
      const kit = new JweKit({ logger, kryptos, encryption: "A256GCM" });

      const { token } = kit.encrypt(PLAINTEXT);

      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, "dir");

      const result = await compactDecrypt(token, joseKey);

      expect(new TextDecoder().decode(result.plaintext)).toBe(PLAINTEXT);
      expect(result.protectedHeader.alg).toBe("dir");
      expect(result.protectedHeader.enc).toBe("A256GCM");
    });

    test("jose encrypt -> aegis decrypt", async () => {
      const kryptos = createOctDirKey("A256GCM");
      const kit = new JweKit({ logger, kryptos, encryption: "A256GCM" });

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
      expect(result.header.algorithm).toBe("dir");
      expect(result.header.encryption).toBe("A256GCM");
    });
  });

  // ---------------------------------------------------------------------------
  // ECDH-ES + A256GCM (EC P-256)
  // ---------------------------------------------------------------------------

  describe("ECDH-ES + A256GCM", () => {
    test("aegis encrypt -> jose decrypt", async () => {
      const kryptos = createEcdhEsKey();
      const kit = new JweKit({ logger, kryptos, encryption: "A256GCM" });

      const { token } = kit.encrypt(PLAINTEXT);

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
