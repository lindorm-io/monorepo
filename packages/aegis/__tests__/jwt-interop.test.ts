import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { importJWK, jwtVerify, SignJWT } from "jose";
import jsonwebtoken, { type JwtPayload } from "jsonwebtoken";
import { JwtKit } from "../src/classes/JwtKit.js";
import { buildProfileClaims } from "../src/internal/utils/build-profile-claims.js";
import { defaultProfile } from "../src/internal/profiles/definitions/default.js";
import type { SignContent } from "../src/types/index.js";
import { describe, expect, test } from "vitest";

// JwtKit.sign is policy-free (T1): it injects no iss/iat/jti/nbf. The historical
// auto-injecting floor now lives in the `default` profile. Interop "aegis sign"
// cases assemble default-profile claims (iss/iat/jti/nbf/exp) and sign them.
const signDefault = (kit: JwtKit, issuer: string, content: SignContent) => {
  const claims = buildProfileClaims(
    { algorithm: kit.algorithm, issuer },
    defaultProfile,
    content,
  );
  return kit.signClaims(claims, content as any);
};

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

      const { token } = signDefault(kit, ISSUER, {
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
      expect(result.protectedHeader.typ).toBe("application/at+jwt");
      expect(result.payload.exp).toBeDefined();
    });

    test("jose sign -> aegis verify", async () => {
      const kryptos = createKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      // jose needs private key for signing
      const jwk = kryptos.export("jwk");
      const joseKey = await importJWK(jwk, jwk.alg);

      const token = await new SignJWT({})
        .setProtectedHeader({ alg: jwk.alg, typ: "at+jwt" })
        .setIssuer(ISSUER)
        .setSubject(SUBJECT)
        .setExpirationTime("1h")
        .setIssuedAt()
        .sign(joseKey);

      const result = kit.verify(token);

      expect(result.payload.issuer).toBe(ISSUER);
      expect(result.payload.subject).toBe(SUBJECT);
      expect(result.header.tokenType).toBe("access_token");
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

      const { token } = signDefault(kit, ISSUER, {
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
      });

      const { publicKey } = kryptos.export("pem");
      const result = jsonwebtoken.verify(token, publicKey!) as JwtPayload;

      expect(result.iss).toBe(ISSUER);
      expect(result.sub).toBe(SUBJECT);
      // token_type is no longer a claim; jsonwebtoken verify doesn't expose header
      expect(jsonwebtoken.decode(token, { complete: true })?.header.typ).toBe(
        "application/at+jwt",
      );
      expect(result.exp).toBeDefined();
    });

    test("jsonwebtoken sign -> aegis verify", () => {
      const kryptos = createRsaSigKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      const { privateKey } = kryptos.export("pem");

      const token = jsonwebtoken.sign({}, privateKey!, {
        algorithm: "RS256",
        expiresIn: "1h",
        header: { alg: "RS256", typ: "at+jwt" },
        issuer: ISSUER,
        subject: SUBJECT,
      });

      const result = kit.verify(token);

      expect(result.payload.issuer).toBe(ISSUER);
      expect(result.payload.subject).toBe(SUBJECT);
      expect(result.header.tokenType).toBe("access_token");
    });
  });

  describe("HS256", () => {
    test("aegis sign -> jsonwebtoken verify", () => {
      const kryptos = createOctSigKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      const { token } = signDefault(kit, ISSUER, {
        expires: "1h",
        subject: SUBJECT,
        tokenType: "access_token",
      });

      const { privateKey } = kryptos.export("der");
      const result = jsonwebtoken.verify(token, privateKey!) as JwtPayload;

      expect(result.iss).toBe(ISSUER);
      expect(result.sub).toBe(SUBJECT);
      expect(jsonwebtoken.decode(token, { complete: true })?.header.typ).toBe(
        "application/at+jwt",
      );
    });

    test("jsonwebtoken sign -> aegis verify", () => {
      const kryptos = createOctSigKey();
      const kit = new JwtKit({ issuer: ISSUER, logger, kryptos });

      const { privateKey } = kryptos.export("der");

      const token = jsonwebtoken.sign({}, privateKey!, {
        algorithm: "HS256",
        expiresIn: "1h",
        header: { alg: "HS256", typ: "at+jwt" },
        issuer: ISSUER,
        subject: SUBJECT,
      });

      const result = kit.verify(token);

      expect(result.payload.issuer).toBe(ISSUER);
      expect(result.payload.subject).toBe(SUBJECT);
      expect(result.header.tokenType).toBe("access_token");
    });
  });
});
