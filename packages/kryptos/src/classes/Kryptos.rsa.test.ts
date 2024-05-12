import MockDate from "mockdate";
import { TEST_RSA_KEY_B64, TEST_RSA_KEY_JWK, TEST_RSA_KEY_PEM } from "../__fixtures__/rsa-keys";
import { Kryptos } from "./Kryptos";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("Kryptos (RSA)", () => {
  test("should generate", async () => {
    const key = await Kryptos.generate("RSA", { modulus: 1 });

    expect(Kryptos.isEc(key)).toBe(false);
    expect(Kryptos.isOct(key)).toBe(false);
    expect(Kryptos.isOkp(key)).toBe(false);
    expect(Kryptos.isRsa(key)).toBe(true);

    expect(key.export("b64")).toEqual({
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "RSA",
    });

    expect(key.export("der")).toEqual({
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "RSA",
    });

    expect(key.export("jwk")).toEqual({
      d: expect.any(String),
      dp: expect.any(String),
      dq: expect.any(String),
      e: "AQAB",
      kty: "RSA",
      n: expect.any(String),
      p: expect.any(String),
      q: expect.any(String),
      qi: expect.any(String),
    });

    expect(key.export("pem")).toEqual({
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "RSA",
    });
  });

  test("should export metadata as json or jwk", async () => {
    const key = await Kryptos.generate("RSA", {
      id: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      algorithm: "ES512",
      createdAt: new Date("2023-01-01T00:00:00.000Z"),
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      isExternal: false,
      issuer: "https://test.lindorm.io/",
      jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
      notBefore: new Date("2024-01-01T08:00:00.000Z"),
      modulus: 2,
      operations: ["encrypt", "decrypt"],
      ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      updatedAt: new Date("2024-01-01T04:00:00.000Z"),
      use: "enc",
    });

    expect(key.toJSON()).toEqual({
      id: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      algorithm: "ES512",
      createdAt: new Date("2023-01-01T00:00:00.000Z"),
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
      type: "RSA",
      updatedAt: new Date("2024-01-01T04:00:00.000Z"),
      use: "enc",
    });

    expect(key.toJWK("both")).toEqual({
      alg: "ES512",
      d: expect.any(String),
      dp: expect.any(String),
      dq: expect.any(String),
      e: "AQAB",
      exp: 1735689600,
      iat: 1672531200,
      iss: "https://test.lindorm.io/",
      jku: "https://test.lindorm.io/.well-known/jwks.json",
      key_ops: ["encrypt", "decrypt"],
      kid: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      kty: "RSA",
      n: expect.any(String),
      nbf: 1704096000,
      owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      p: expect.any(String),
      q: expect.any(String),
      qi: expect.any(String),
      uat: 1704081600,
      use: "enc",
    });
  });

  test("should create from existing B64 key", async () => {
    const key = Kryptos.from("b64", TEST_RSA_KEY_B64);

    expect(key.export("b64")).toEqual(TEST_RSA_KEY_B64);

    expect(key.export("der")).toEqual({
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "RSA",
    });

    expect(key.export("jwk")).toEqual({
      d: expect.any(String),
      dp: expect.any(String),
      dq: expect.any(String),
      e: "AQAB",
      kty: "RSA",
      n: expect.any(String),
      p: expect.any(String),
      q: expect.any(String),
      qi: expect.any(String),
    });

    expect(key.export("pem")).toEqual({
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "RSA",
    });
  });

  test("should create from existing JWK key", async () => {
    const key = Kryptos.from("jwk", TEST_RSA_KEY_JWK);

    expect(key.export("b64")).toEqual({
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "RSA",
    });

    expect(key.export("der")).toEqual({
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "RSA",
    });

    expect(key.export("jwk")).toEqual(TEST_RSA_KEY_JWK);

    expect(key.export("pem")).toEqual({
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "RSA",
    });
  });

  test("should create from existing PEM key", async () => {
    const key = Kryptos.from("pem", TEST_RSA_KEY_PEM);

    expect(key.export("b64")).toEqual({
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "RSA",
    });

    expect(key.export("der")).toEqual({
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "RSA",
    });

    expect(key.export("jwk")).toEqual({
      d: expect.any(String),
      dp: expect.any(String),
      dq: expect.any(String),
      e: "AQAB",
      kty: "RSA",
      n: expect.any(String),
      p: expect.any(String),
      q: expect.any(String),
      qi: expect.any(String),
    });

    expect(key.export("pem")).toEqual(TEST_RSA_KEY_PEM);
  });
});
