import MockDate from "mockdate";
import {
  TEST_OKP_KEY_B64,
  TEST_OKP_KEY_JWK,
  TEST_OKP_KEY_PEM,
} from "../__fixtures__/okp-keys";
import { OkpB64, OkpDer } from "../types";
import { Kryptos } from "./Kryptos";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("Kryptos (OKP)", () => {
  describe("create", () => {
    test("should generate", async () => {
      const key = Kryptos.generate({ type: "OKP", use: "sig", curve: "Ed25519" });

      expect(Kryptos.isEc(key)).toBe(false);
      expect(Kryptos.isOct(key)).toBe(false);
      expect(Kryptos.isOkp(key)).toBe(true);
      expect(Kryptos.isRsa(key)).toBe(false);

      expect(key.export("b64")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "OKP",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "EdDSA",
        crv: "Ed25519",
        d: expect.any(String),
        kty: "OKP",
        x: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "sig",
      });
    });

    test("should be able to recover public key from private key buffer", async () => {
      const key = Kryptos.make(TEST_OKP_KEY_B64);
      const der = key.export("der") as OkpDer;

      const { publicKey, ...without } = der;
      const test = Kryptos.make(without as any);

      expect(key.export("b64")).toEqual(test.export("b64"));
    });

    test("should be able to recover public key from private key base64", async () => {
      const key = Kryptos.make(TEST_OKP_KEY_B64);
      const b64 = key.export("b64") as OkpB64;

      const { publicKey, ...without } = b64;
      const test = Kryptos.make(without as any);

      expect(key.export("b64")).toEqual(test.export("b64"));
    });
  });

  describe("clone", () => {
    test("should clone", async () => {
      const key = Kryptos.generate({ type: "OKP", use: "sig", curve: "Ed25519" });
      const clone = key.clone();
      expect(clone).toEqual(key);
      expect(key.export("pem")).toEqual(clone.export("pem"));
    });

    test("should clone with new ID", async () => {
      const key = Kryptos.generate({ type: "OKP", use: "sig", curve: "Ed25519" });

      expect(key.clone({ algorithm: "HS384" })).toEqual(
        expect.objectContaining({
          id: expect.not.stringMatching(key.id),
          algorithm: "HS384",
        }),
      );
    });
  });

  describe("metadata", () => {
    test("should export metadata", async () => {
      const key = Kryptos.generate({
        curve: "Ed25519",
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        type: "OKP",
        use: "sig",
      });

      expect(key.toJSON()).toEqual({
        id: expect.any(String),
        algorithm: "EdDSA",
        createdAt: new Date("2024-01-01T08:00:00.000Z"),
        curve: "Ed25519",
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        expiresIn: 31593600,
        isActive: true,
        isExpired: false,
        isExternal: false,
        isUsable: true,
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        type: "OKP",
        updatedAt: new Date("2024-01-01T08:00:00.000Z"),
        use: "sig",
      });
    });
  });

  describe("jwks", () => {
    test("should export private key to jwk", async () => {
      const key = Kryptos.generate({
        curve: "Ed25519",
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        type: "OKP",
        use: "sig",
      });

      expect(key.toJWK("private")).toEqual({
        alg: "EdDSA",
        crv: "Ed25519",
        d: expect.any(String),
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "OKP",
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        uat: 1704096000,
        use: "sig",
        x: expect.any(String),
      });
    });

    test("should export public key to jwk", async () => {
      const key = Kryptos.generate({
        curve: "Ed25519",
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        type: "OKP",
        use: "sig",
      });

      expect(key.toJWK("public")).toEqual({
        alg: "EdDSA",
        crv: "Ed25519",
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "OKP",
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        uat: 1704096000,
        use: "sig",
        x: expect.any(String),
      });
    });
  });

  describe("from", () => {
    test("should create from existing B64 key", async () => {
      const key = Kryptos.from("b64", TEST_OKP_KEY_B64);

      expect(key.export("b64")).toEqual(TEST_OKP_KEY_B64);

      expect(key.export("der")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "OKP",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "EdDSA",
        crv: "Ed25519",
        d: expect.any(String),
        kty: "OKP",
        x: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "sig",
      });
    });

    test("should create from existing JWK key", async () => {
      const key = Kryptos.from("jwk", TEST_OKP_KEY_JWK);

      expect(key.export("b64")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "OKP",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual(TEST_OKP_KEY_JWK);

      expect(key.export("pem")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "sig",
      });
    });

    test("should create from existing PEM key", async () => {
      const key = Kryptos.from("pem", TEST_OKP_KEY_PEM);

      expect(key.export("b64")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "OKP",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "EdDSA",
        curve: "Ed25519",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "OKP",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "EdDSA",
        crv: "Ed25519",
        d: expect.any(String),
        kty: "OKP",
        x: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual(TEST_OKP_KEY_PEM);
    });
  });

  describe("make", () => {
    test("should make from B64", () => {
      const make = Kryptos.make(TEST_OKP_KEY_B64);
      expect(make.export("b64")).toEqual(TEST_OKP_KEY_B64);
    });

    test("should make from JWK", () => {
      const make = Kryptos.make(TEST_OKP_KEY_JWK);
      expect(make.export("jwk")).toEqual(TEST_OKP_KEY_JWK);
    });

    test("should make from PEM", () => {
      const make = Kryptos.make(TEST_OKP_KEY_PEM);
      expect(make.export("pem")).toEqual(TEST_OKP_KEY_PEM);
    });
  });
});
