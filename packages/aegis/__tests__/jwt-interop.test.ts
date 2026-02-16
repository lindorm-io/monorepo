import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger";
import { importJWK, jwtVerify, SignJWT } from "jose";
import type { JwtPayload } from "jsonwebtoken";
import { createRequire } from "module";
import { JwtKit } from "../src/classes/JwtKit";

const require = createRequire(import.meta.url);
const jsonwebtoken = require("jsonwebtoken") as typeof import("jsonwebtoken");

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const ISSUER = "https://interop.test.lindorm.io/";
const SUBJECT = "d4e5f6a7-b8c9-4d0e-1a2b-3c4d5e6f7890";
const logger = createMockLogger();

// ---------------------------------------------------------------------------
// Key generation helpers
// ---------------------------------------------------------------------------

const createEcSigKey = () =>
  KryptosKit.generate.sig.ec({ algorithm: "ES256", curve: "P-256" });

const createRsaSigKey = () => KryptosKit.generate.sig.rsa({ algorithm: "RS256" });

const createOctSigKey = () => KryptosKit.generate.sig.oct({ algorithm: "HS256" });

// ---------------------------------------------------------------------------
// Helper: export public-only JWK for jose verification
// ---------------------------------------------------------------------------

const toPublicJwk = (jwk: Record<string, unknown>): Record<string, unknown> => {
  const { d, dp, dq, p, q, qi, k, ...publicParts } = jwk as any;
  return publicParts;
};

// ---------------------------------------------------------------------------
// jose JWT interop
// ---------------------------------------------------------------------------

describe("JWT interop: aegis <-> jose", () => {
  describe.each([
    { name: "EC / ES256", createKey: createEcSigKey, asymmetric: true },
    { name: "RSA / RS256", createKey: createRsaSigKey, asymmetric: true },
    { name: "oct / HS256", createKey: createOctSigKey, asymmetric: false },
  ])("$name", ({ createKey, asymmetric }) => {
    test("aegis sign -> jose verify", async () => {
      const kryptos = createKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      const { token } = kit.sign({
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
      });

      // jose needs public key for asymmetric verification, full key for symmetric
      const jwk = kryptos.export("jwk");
      const verifyJwk = asymmetric ? toPublicJwk(jwk) : jwk;
      const joseKey = await importJWK(verifyJwk, jwk.alg);

      const result = await jwtVerify(token, joseKey);

      expect(result.payload.iss).toBe(ISSUER);
      expect(result.payload.sub).toBe(SUBJECT);
      expect(result.payload.token_type).toBe("access_token");
      expect(result.payload.exp).toBeDefined();
    });

    test("jose sign -> aegis verify", async () => {
      const kryptos = createKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      // jose needs private key for signing
      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, jwk.alg);

      const token = await new SignJWT({ token_type: "access_token" })
        .setProtectedHeader({ alg: jwk.alg, typ: "JWT" })
        .setIssuer(ISSUER)
        .setSubject(SUBJECT)
        .setExpirationTime("1h")
        .setIssuedAt()
        .sign(joseKey);

      const result = kit.verify(token);

      expect(result.payload.issuer).toBe(ISSUER);
      expect(result.payload.subject).toBe(SUBJECT);
      expect(result.payload.tokenType).toBe("access_token");
      expect(result.payload.expiresAt).toBeInstanceOf(Date);
    });
  });
});

// ---------------------------------------------------------------------------
// jsonwebtoken JWT interop
// ---------------------------------------------------------------------------

describe("JWT interop: aegis <-> jsonwebtoken", () => {
  describe("RS256", () => {
    test("aegis sign -> jsonwebtoken verify", () => {
      const kryptos = createRsaSigKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      const { token } = kit.sign({
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
      });

      const { publicKey } = kryptos.export("pem");
      const result = jsonwebtoken.verify(token, publicKey!) as JwtPayload;

      expect(result.iss).toBe(ISSUER);
      expect(result.sub).toBe(SUBJECT);
      expect(result.token_type).toBe("access_token");
      expect(result.exp).toBeDefined();
    });

    test("jsonwebtoken sign -> aegis verify", () => {
      const kryptos = createRsaSigKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      const { privateKey } = kryptos.export("pem");

      const token = jsonwebtoken.sign({ token_type: "access_token" }, privateKey!, {
        algorithm: "RS256",
        expiresIn: "1h",
        issuer: ISSUER,
        subject: SUBJECT,
      });

      const result = kit.verify(token);

      expect(result.payload.issuer).toBe(ISSUER);
      expect(result.payload.subject).toBe(SUBJECT);
      expect(result.payload.tokenType).toBe("access_token");
    });
  });

  describe("HS256", () => {
    test("aegis sign -> jsonwebtoken verify", () => {
      const kryptos = createOctSigKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      const { token } = kit.sign({
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
      });

      const { privateKey } = kryptos.export("der");
      const result = jsonwebtoken.verify(token, privateKey!) as JwtPayload;

      expect(result.iss).toBe(ISSUER);
      expect(result.sub).toBe(SUBJECT);
      expect(result.token_type).toBe("access_token");
    });

    test("jsonwebtoken sign -> aegis verify", () => {
      const kryptos = createOctSigKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      const { privateKey } = kryptos.export("der");

      const token = jsonwebtoken.sign({ token_type: "access_token" }, privateKey!, {
        algorithm: "HS256",
        expiresIn: "1h",
        issuer: ISSUER,
        subject: SUBJECT,
      });

      const result = kit.verify(token);

      expect(result.payload.issuer).toBe(ISSUER);
      expect(result.payload.subject).toBe(SUBJECT);
      expect(result.payload.tokenType).toBe("access_token");
    });
  });
});
