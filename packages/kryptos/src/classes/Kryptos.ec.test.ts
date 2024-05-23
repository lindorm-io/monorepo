import MockDate from "mockdate";
import {
  TEST_EC_KEY_B64,
  TEST_EC_KEY_JWK,
  TEST_EC_KEY_PEM,
} from "../__fixtures__/ec-keys";
import { EcB64, EcDer } from "../types";
import { Kryptos } from "./Kryptos";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("Kryptos", () => {
  describe("create", () => {
    test("should generate", async () => {
      const key = Kryptos.generate({ algorithm: "ES512", type: "EC", use: "sig" });

      expect(Kryptos.isEc(key)).toBe(true);
      expect(Kryptos.isOct(key)).toBe(false);
      expect(Kryptos.isOkp(key)).toBe(false);
      expect(Kryptos.isRsa(key)).toBe(false);

      expect(key.hasPrivateKey).toEqual(true);
      expect(key.hasPublicKey).toEqual(true);

      expect(key.operations).toEqual(["sign", "verify"]);
    });

    test("should generate encryption key", async () => {
      const key = Kryptos.generate({
        algorithm: "ECDH-ES+A192KW",
        type: "EC",
        use: "enc",
      });

      expect(key.operations).toEqual(["encrypt", "decrypt"]);
    });

    test("should be able to recover public key from private key buffer", async () => {
      const key = Kryptos.make(TEST_EC_KEY_B64);
      const der = key.export("der") as EcDer;

      const { publicKey, ...without } = der;
      const test = Kryptos.make(without as any);

      expect(key.export("b64")).toEqual(test.export("b64"));
    });

    test("should be able to recover public key from private key base64", async () => {
      const key = Kryptos.make(TEST_EC_KEY_B64);
      const b64 = key.export("b64") as EcB64;

      const { publicKey, ...without } = b64;
      const test = Kryptos.make(without as any);

      expect(key.export("b64")).toEqual(test.export("b64"));
    });

    test("should auto generate", async () => {
      const key = Kryptos.auto({ algorithm: "ES512" });

      expect(key.type).toEqual("EC");
      expect(key.use).toEqual("sig");

      expect(key.operations).toEqual(["sign", "verify"]);
    });
  });

  describe("export", () => {
    test("should export", async () => {
      const key = Kryptos.generate({ algorithm: "ES512", type: "EC", use: "sig" });

      expect(key.export("b64")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "EC",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "ES512",
        crv: "P-521",
        d: expect.any(String),
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "sig",
      });
    });
  });

  describe("clone", () => {
    test("should clone", async () => {
      const key = Kryptos.generate({ algorithm: "ES512", type: "EC", use: "sig" });
      const clone = key.clone();
      expect(clone).toEqual(key);
      expect(key.export("pem")).toEqual(clone.export("pem"));
    });
  });

  describe("metadata", () => {
    test("should export metadata", async () => {
      const key = Kryptos.generate({
        algorithm: "ECDH-ES+A256KW",
        type: "EC",
        use: "enc",

        encryption: "A192CBC-HS384",
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      });

      expect(key.toJSON()).toEqual({
        id: expect.any(String),
        algorithm: "ECDH-ES+A256KW",
        encryption: "A192CBC-HS384",
        createdAt: new Date("2024-01-01T08:00:00.000Z"),
        curve: "P-521",
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        expiresIn: 31593600,
        hasPrivateKey: true,
        hasPublicKey: true,
        isActive: true,
        isExpired: false,
        isExternal: false,
        issuer: "https://test.lindorm.io/",
        isUsable: true,
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        type: "EC",
        updatedAt: new Date("2024-01-01T08:00:00.000Z"),
        use: "enc",
      });
    });
  });

  describe("jwks", () => {
    test("should export private key to jwk", async () => {
      const key = Kryptos.generate({
        algorithm: "ECDH-ES+A256KW",
        type: "EC",
        use: "enc",

        encryption: "A192CBC-HS384",
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      });

      expect(key.toJWK("private")).toEqual({
        alg: "ECDH-ES+A256KW",
        crv: "P-521",
        d: expect.any(String),
        enc: "A192CBC-HS384",
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "EC",
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        uat: 1704096000,
        use: "enc",
        x: expect.any(String),
        y: expect.any(String),
      });
    });

    test("should export public key to jwk", async () => {
      const key = Kryptos.generate({
        algorithm: "ECDH-ES+A256KW",
        type: "EC",
        use: "enc",

        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      });

      expect(key.toJWK("public")).toEqual({
        alg: "ECDH-ES+A256KW",
        crv: "P-521",
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "EC",
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        uat: 1704096000,
        use: "enc",
        x: expect.any(String),
        y: expect.any(String),
      });
    });
  });

  describe("from", () => {
    test("should create from existing B64 key", async () => {
      const key = Kryptos.from("b64", TEST_EC_KEY_B64);

      expect(key.export("b64")).toEqual(TEST_EC_KEY_B64);

      expect(key.export("der")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "EC",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "ES512",
        crv: "P-521",
        d: expect.any(String),
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "sig",
      });
    });

    test("should create from existing JWK key", async () => {
      const key = Kryptos.from("jwk", TEST_EC_KEY_JWK);

      expect(key.export("b64")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "EC",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual(TEST_EC_KEY_JWK);

      expect(key.export("pem")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "sig",
      });
    });

    test("should create from existing PEM key", async () => {
      const key = Kryptos.from("pem", TEST_EC_KEY_PEM);

      expect(key.export("b64")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(String),
        publicKey: expect.any(String),
        type: "EC",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "ES512",
        curve: "P-521",
        privateKey: expect.any(Buffer),
        publicKey: expect.any(Buffer),
        type: "EC",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "ES512",
        crv: "P-521",
        d: expect.any(String),
        kty: "EC",
        x: expect.any(String),
        y: expect.any(String),
        use: "sig",
      });

      expect(key.export("pem")).toEqual(TEST_EC_KEY_PEM);
    });
  });

  describe("make", () => {
    test("should make from B64", () => {
      const make = Kryptos.make(TEST_EC_KEY_B64);
      expect(make.export("b64")).toEqual(TEST_EC_KEY_B64);
    });

    test("should make from JWK", () => {
      const make = Kryptos.make(TEST_EC_KEY_JWK);
      expect(make.export("jwk")).toEqual(TEST_EC_KEY_JWK);
    });

    test("should make from PEM", () => {
      const make = Kryptos.make(TEST_EC_KEY_PEM);
      expect(make.export("pem")).toEqual(TEST_EC_KEY_PEM);
    });
  });
});
