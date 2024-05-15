import MockDate from "mockdate";
import {
  TEST_OCT_KEY_B64,
  TEST_OCT_KEY_JWK,
  TEST_OCT_KEY_PEM,
} from "../__fixtures__/oct-keys";
import { Kryptos } from "./Kryptos";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("Kryptos (oct)", () => {
  describe("create", () => {
    test("should generate", async () => {
      const key = await Kryptos.generate({ type: "oct", use: "sig", size: 256 });

      expect(Kryptos.isEc(key)).toBe(false);
      expect(Kryptos.isOct(key)).toBe(true);
      expect(Kryptos.isOkp(key)).toBe(false);
      expect(Kryptos.isRsa(key)).toBe(false);

      expect(key.export("b64")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(Buffer),
        publicKey: Buffer.alloc(0),
        type: "oct",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "HS512",
        k: expect.any(String),
        kty: "oct",
        use: "sig",
      });

      expect(key.export("pem")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });
    });
  });

  describe("clone", () => {
    test("should clone", async () => {
      const key = await Kryptos.generate({ type: "oct", use: "sig", size: 256 });
      const clone = key.clone();
      expect(clone).toEqual(key);
      expect(key.export("pem")).toEqual(clone.export("pem"));
    });

    test("should clone with new ID", async () => {
      const key = await Kryptos.generate({ type: "oct", use: "sig", size: 256 });

      expect(key.clone({ use: "enc" })).toEqual(
        expect.objectContaining({
          id: expect.not.stringMatching(key.id),
          algorithm: "dir",
          use: "enc",
        }),
      );
    });
  });

  describe("metadata", () => {
    test("should export metadata", async () => {
      const key = await Kryptos.generate({
        expiresAt: new Date("2025-01-01T00:00:00.000Z"),
        issuer: "https://test.lindorm.io/",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
        notBefore: new Date("2024-01-01T08:00:00.000Z"),
        operations: ["encrypt", "decrypt"],
        ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        size: 64,
        type: "oct",
        use: "enc",
      });

      expect(key.toJSON()).toEqual({
        id: expect.any(String),
        algorithm: "dir",
        createdAt: new Date("2024-01-01T08:00:00.000Z"),
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
        type: "oct",
        updatedAt: new Date("2024-01-01T08:00:00.000Z"),
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
        size: 64,
        type: "oct",
        use: "enc",
      });

      expect(key.toJWK("private")).toEqual({
        alg: "dir",
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        k: expect.any(String),
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "oct",
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
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
        size: 64,
        type: "oct",
        use: "enc",
      });

      expect(key.toJWK("public")).toEqual({
        alg: "dir",
        exp: 1735689600,
        iat: 1704096000,
        iss: "https://test.lindorm.io/",
        jku: "https://test.lindorm.io/.well-known/jwks.json",
        k: "",
        key_ops: ["encrypt", "decrypt"],
        kid: expect.any(String),
        kty: "oct",
        nbf: 1704096000,
        owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
        uat: 1704096000,
        use: "enc",
      });
    });
  });

  describe("from", () => {
    test("should create from existing B64 key", async () => {
      const key = Kryptos.from("b64", TEST_OCT_KEY_B64);

      expect(key.export("b64")).toEqual(TEST_OCT_KEY_B64);

      expect(key.export("der")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(Buffer),
        publicKey: Buffer.alloc(0),
        type: "oct",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "HS512",
        k: expect.any(String),
        kty: "oct",
        use: "sig",
      });

      expect(key.export("pem")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });
    });

    test("should create from existing JWK key", async () => {
      const key = Kryptos.from("jwk", TEST_OCT_KEY_JWK);

      expect(key.export("b64")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(Buffer),
        publicKey: Buffer.alloc(0),
        type: "oct",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual(TEST_OCT_KEY_JWK);

      expect(key.export("pem")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });
    });

    test("should create from existing PEM key", async () => {
      const key = Kryptos.from("pem", TEST_OCT_KEY_PEM);

      expect(key.export("b64")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(String),
        publicKey: "",
        type: "oct",
        use: "sig",
      });

      expect(key.export("der")).toEqual({
        algorithm: "HS512",
        privateKey: expect.any(Buffer),
        publicKey: Buffer.alloc(0),
        type: "oct",
        use: "sig",
      });

      expect(key.export("jwk")).toEqual({
        alg: "HS512",
        k: expect.any(String),
        kty: "oct",
        use: "sig",
      });

      expect(key.export("pem")).toEqual(TEST_OCT_KEY_PEM);
    });
  });

  describe("make", () => {
    test("should make from B64", () => {
      const make = Kryptos.make(TEST_OCT_KEY_B64);
      expect(make.export("b64")).toEqual(TEST_OCT_KEY_B64);
    });

    test("should make from JWK", () => {
      const make = Kryptos.make(TEST_OCT_KEY_JWK);
      expect(make.export("jwk")).toEqual(TEST_OCT_KEY_JWK);
    });

    test("should make from PEM", () => {
      const make = Kryptos.make(TEST_OCT_KEY_PEM);
      expect(make.export("pem")).toEqual(TEST_OCT_KEY_PEM);
    });
  });
});
