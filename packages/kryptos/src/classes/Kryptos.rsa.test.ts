import MockDate from "mockdate";
import {
  TEST_RSA_KEY_B64,
  TEST_RSA_KEY_JWK,
  TEST_RSA_KEY_PEM,
} from "../__fixtures__/rsa-keys";
import { RsaB64, RsaDer } from "../types";
import { Kryptos } from "./Kryptos";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("Kryptos (RSA)", () => {
  describe("create", () => {
    test("should generate", async () => {
      const key = await Kryptos.generate({ type: "RSA", use: "sig", size: 2 });

      expect(Kryptos.isEc(key)).toBe(false);
      expect(Kryptos.isOct(key)).toBe(false);
      expect(Kryptos.isOkp(key)).toBe(false);
      expect(Kryptos.isRsa(key)).toBe(true);

      expect(key.export("b64")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "RSA",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "RS256",
        d: expect.any(String),
        dp: expect.any(String),
        dq: expect.any(String),
        e: "AQAB",
        kty: "RSA",
        n: expect.any(String),
        p: expect.any(String),
        q: expect.any(String),
        qi: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });
    });

    test("should be able to recover public key from private key buffer", async () => {
      const key = Kryptos.make(TEST_RSA_KEY_B64);
      const der = key.export("der") as RsaDer;

      const { publicKey, ...without } = der;
      const test = Kryptos.make(without as any);

      expect(key.export("b64")).toEqual(test.export("b64"));
    });

    test("should be able to recover public key from private key base64", async () => {
      const key = Kryptos.make(TEST_RSA_KEY_B64);
      const b64 = key.export("b64") as RsaB64;

      const { publicKey, ...without } = b64;
      const test = Kryptos.make(without as any);

      expect(key.export("b64")).toEqual(test.export("b64"));
    });
  });

  describe("clone", () => {
    test("should clone", async () => {
      const key = await Kryptos.generate({ type: "RSA", use: "sig", size: 2 });
      const clone = key.clone();
      expect(clone).toEqual(key);
      expect(key.export("pem")).toEqual(clone.export("pem"));
    });

    test("should clone with new ID", async () => {
      const key = await Kryptos.generate({ type: "RSA", use: "sig", size: 2 });

      expect(key.clone({ use: "enc" })).toEqual(
        expect.objectContaining({
          id: expect.not.stringMatching(key.id),
          algorithm: "RSA-OAEP-256",
          use: "enc",
        }),
      );
    });
  });

  describe("metadata", () => {
    test("should export metadata as json or jwk", async () => {
      const key = await Kryptos.generate({
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        size: 2,
        type: "RSA",
        use: "enc",
      });

      expect(key.toJSON()).toEqual({
        id: expect.any(String),
        algorithm: "RSA-OAEP-256",
        createdAt: new Date("2024-01-01T08:00:00.000Z"),
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        expiresIn: 31593600,
        isActive: true,
        isExpired: false,
        isExternal: false,
        isUsable: true,
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        modulus: 2048,
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        type: "RSA",
        updatedAt: new Date("2024-01-01T08:00:00.000Z"),
        use: "enc",
      });

      expect(key.toJWK("private")).toEqual({
        alg: "RSA-OAEP-256",
        d: expect.any(String),
        dp: expect.any(String),
        dq: expect.any(String),
        e: "AQAB",
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "RSA",
        n: expect.any(String),
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        p: expect.any(String),
        q: expect.any(String),
        qi: expect.any(String),
        uat: 1704096000,
        use: "enc",
      });
    });
  });

  describe("jwks", () => {
    test("should export private key to jwk", async () => {
      const key = await Kryptos.generate({
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        size: 2,
        type: "RSA",
        use: "enc",
      });

      expect(key.toJWK("private")).toEqual({
        alg: "RSA-OAEP-256",
        d: expect.any(String),
        dp: expect.any(String),
        dq: expect.any(String),
        e: "AQAB",
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "RSA",
        n: expect.any(String),
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        p: expect.any(String),
        q: expect.any(String),
        qi: expect.any(String),
        uat: 1704096000,
        use: "enc",
      });
    });

    test("should export public key to jwk", async () => {
      const key = await Kryptos.generate({
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        size: 2,
        type: "RSA",
        use: "enc",
      });

      expect(key.toJWK("public")).toEqual({
        alg: "RSA-OAEP-256",
        e: "AQAB",
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "RSA",
        n: expect.any(String),
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        uat: 1704096000,
        use: "enc",
      });
    });
  });

  describe("from", () => {
    test("should create from existing B64 key", async () => {
      const key = Kryptos.from("b64", TEST_RSA_KEY_B64);

      expect(key.export("b64")).toEqual(TEST_RSA_KEY_B64);

      expect(key.export("der")).toEqual({
        algorithm: "RS512",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "RSA",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "RS512",
        d: expect.any(String),
        dp: expect.any(String),
        dq: expect.any(String),
        e: "AQAB",
        kty: "RSA",
        n: expect.any(String),
        p: expect.any(String),
        q: expect.any(String),
        qi: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual({
        algorithm: "RS512",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });
    });

    test("should create from existing JWK key", async () => {
      const key = Kryptos.from("jwk", TEST_RSA_KEY_JWK);

      expect(key.export("b64")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "RSA",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual(TEST_RSA_KEY_JWK);

      expect(key.export("pem")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });
    });

    test("should create from existing PEM key", async () => {
      const key = Kryptos.from("pem", TEST_RSA_KEY_PEM);

      expect(key.export("b64")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "RSA",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "RS256",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "RSA",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "RS256",
        d: expect.any(String),
        dp: expect.any(String),
        dq: expect.any(String),
        e: "AQAB",
        kty: "RSA",
        n: expect.any(String),
        p: expect.any(String),
        q: expect.any(String),
        qi: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual(TEST_RSA_KEY_PEM);
    });
  });

  describe("make", () => {
    test("should make from B64", () => {
      const make = Kryptos.make(TEST_RSA_KEY_B64);
      expect(make.export("b64")).toEqual(TEST_RSA_KEY_B64);
    });

    test("should make from JWK", () => {
      const make = Kryptos.make(TEST_RSA_KEY_JWK);
      expect(make.export("jwk")).toEqual(TEST_RSA_KEY_JWK);
    });

    test("should make from PEM", () => {
      const make = Kryptos.make(TEST_RSA_KEY_PEM);
      expect(make.export("pem")).toEqual(TEST_RSA_KEY_PEM);
    });
  });
});
