import MockDate from "mockdate";
import { TEST_OCT_KEY_B64, TEST_OCT_KEY_JWK, TEST_OCT_KEY_PEM } from "../__fixtures__/oct-keys";
import { Kryptos } from "./Kryptos";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("Kryptos (oct)", () => {
  test("should generate", async () => {
    const key = await Kryptos.generate("oct");

    expect(Kryptos.isEc(key)).toBe(false);
    expect(Kryptos.isOct(key)).toBe(true);
    expect(Kryptos.isOkp(key)).toBe(false);
    expect(Kryptos.isRsa(key)).toBe(false);

    expect(key.export("b64")).toEqual({
      privateKey: expect.any(String),
      type: "oct",
    });

    expect(key.export("der")).toEqual({
      privateKey: expect.any(Buffer),
      type: "oct",
    });

    expect(key.export("jwk")).toEqual({
      k: expect.any(String),
      kty: "oct",
    });

    expect(key.export("pem")).toEqual({
      privateKey: expect.any(String),
      type: "oct",
    });
  });

  test("should export metadata as json or jwk", async () => {
    const key = await Kryptos.generate("oct", {
      id: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      algorithm: "HS512",
      createdAt: new Date("2023-01-01T00:00:00.000Z"),
      expiresAt: new Date("2025-01-01T00:00:00.000Z"),
      isExternal: false,
      issuer: "https://test.lindorm.io/",
      jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
      notBefore: new Date("2024-01-01T08:00:00.000Z"),
      operations: ["encrypt", "decrypt"],
      ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      size: 32,
      updatedAt: new Date("2024-01-01T04:00:00.000Z"),
      use: "enc",
    });

    expect(key.toJSON()).toEqual({
      id: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      algorithm: "HS512",
      createdAt: new Date("2023-01-01T00:00:00.000Z"),
      curve: undefined,
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
      updatedAt: new Date("2024-01-01T04:00:00.000Z"),
      use: "enc",
    });

    expect(key.toJWK("both")).toEqual({
      alg: "HS512",
      exp: 1735689600,
      iat: 1672531200,
      iss: "https://test.lindorm.io/",
      jku: "https://test.lindorm.io/.well-known/jwks.json",
      k: expect.any(String),
      key_ops: ["encrypt", "decrypt"],
      kid: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      kty: "oct",
      nbf: 1704096000,
      owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      uat: 1704081600,
      use: "enc",
    });
  });

  test("should create from existing B64 key", async () => {
    const key = Kryptos.from("b64", TEST_OCT_KEY_B64);

    expect(key.export("b64")).toEqual(TEST_OCT_KEY_B64);

    expect(key.export("der")).toEqual({
      privateKey: expect.any(Buffer),
      type: "oct",
    });

    expect(key.export("jwk")).toEqual({
      k: expect.any(String),
      kty: "oct",
    });

    expect(key.export("pem")).toEqual({
      privateKey: expect.any(String),
      type: "oct",
    });
  });

  test("should create from existing JWK key", async () => {
    const key = Kryptos.from("jwk", TEST_OCT_KEY_JWK);

    expect(key.export("b64")).toEqual({
      privateKey: expect.any(String),
      type: "oct",
    });

    expect(key.export("der")).toEqual({
      privateKey: expect.any(Buffer),
      type: "oct",
    });

    expect(key.export("jwk")).toEqual(TEST_OCT_KEY_JWK);

    expect(key.export("pem")).toEqual({
      privateKey: expect.any(String),
      type: "oct",
    });
  });

  test("should create from existing PEM key", async () => {
    const key = Kryptos.from("pem", TEST_OCT_KEY_PEM);

    expect(key.export("b64")).toEqual({
      privateKey: expect.any(String),
      type: "oct",
    });

    expect(key.export("der")).toEqual({
      privateKey: expect.any(Buffer),
      type: "oct",
    });

    expect(key.export("jwk")).toEqual({
      k: expect.any(String),
      kty: "oct",
    });

    expect(key.export("pem")).toEqual(TEST_OCT_KEY_PEM);
  });
});
