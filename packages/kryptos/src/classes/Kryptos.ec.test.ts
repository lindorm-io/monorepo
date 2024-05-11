import MockDate from "mockdate";
import {
  TEST_EC_KEY_B64,
  TEST_EC_KEY_JWK,
  TEST_EC_KEY_PEM,
  TEST_EC_KEY_RAW,
} from "../__fixtures__/ec-keys";
import { Kryptos } from "./Kryptos";

const MockedDate = new Date("2024-05-10T00:00:00.000Z");
MockDate.set(MockedDate.toISOString());

describe("Kryptos", () => {
  test("should generate EC", async () => {
    const key = await Kryptos.generate("EC");

    expect(Kryptos.isEc(key)).toBe(true);
    expect(Kryptos.isOct(key)).toBe(false);
    expect(Kryptos.isOkp(key)).toBe(false);
    expect(Kryptos.isRsa(key)).toBe(false);

    expect(key.export("b64")).toEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });

    expect(key.export("der")).toEqual({
      curve: "P-521",
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "EC",
    });

    expect(key.export("jwk")).toEqual({
      crv: "P-521",
      d: expect.any(String),
      kty: "EC",
      x: expect.any(String),
      y: expect.any(String),
    });

    expect(key.export("pem")).toEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });
  });

  test("should export metadata as json or jwk", async () => {
    const key = await Kryptos.generate("EC", {
      id: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      algorithm: "ES512",
      createdAt: new Date("2024-05-08T00:00:00.000Z"),
      curve: "P-521",
      expiresAt: new Date("2024-05-11T00:00:00.000Z"),
      isExternal: false,
      jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
      notBefore: new Date("2024-05-10T01:00:00.000Z"),
      operations: ["encrypt", "decrypt"],
      ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      updatedAt: new Date("2024-05-09T00:00:00.000Z"),
      use: "enc",
    });

    expect(key.toJSON()).toEqual({
      id: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      algorithm: "ES512",
      createdAt: new Date("2024-05-08T00:00:00.000Z"),
      curve: "P-521",
      expiresAt: new Date("2024-05-11T00:00:00.000Z"),
      expiresIn: 86400,
      isExpired: false,
      isExternal: false,
      isUsable: false,
      jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
      notBefore: new Date("2024-05-10T01:00:00.000Z"),
      operations: ["encrypt", "decrypt"],
      ownerId: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      type: "EC",
      updatedAt: new Date("2024-05-09T00:00:00.000Z"),
      use: "enc",
    });

    expect(key.toJWK("both")).toEqual({
      alg: "ES512",
      crv: "P-521",
      d: expect.any(String),
      exp: 1715385600,
      expires_in: 86400,
      iat: 1715126400,
      jku: "https://test.lindorm.io/.well-known/jwks.json",
      key_ops: ["encrypt", "decrypt"],
      kid: "27c10c28-a076-5614-a1f7-1f5d92d10d45",
      kty: "EC",
      nbf: 1715302800,
      owner_id: "2c3d8e05-b382-5b31-898c-2d1f6009f5c1",
      uat: 1715212800,
      use: "enc",
      x: expect.any(String),
      y: expect.any(String),
    });
  });

  test("should create from existing B64 key", async () => {
    const key = Kryptos.from("b64", TEST_EC_KEY_B64);

    expect(key.export("b64")).toEqual(TEST_EC_KEY_B64);

    expect(key.export("der")).toEqual({
      curve: "P-521",
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "EC",
    });

    expect(key.export("jwk")).toEqual({
      crv: "P-521",
      d: expect.any(String),
      kty: "EC",
      x: expect.any(String),
      y: expect.any(String),
    });

    expect(key.export("pem")).toEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });
  });

  test("should create from existing JWK key", async () => {
    const key = Kryptos.from("jwk", TEST_EC_KEY_JWK);

    expect(key.export("b64")).toEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });

    expect(key.export("der")).toEqual({
      curve: "P-521",
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "EC",
    });

    expect(key.export("jwk")).toEqual(TEST_EC_KEY_JWK);

    expect(key.export("pem")).toEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });
  });

  test("should create from existing PEM key", async () => {
    const key = Kryptos.from("pem", TEST_EC_KEY_PEM);

    expect(key.export("b64")).toEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });

    expect(key.export("der")).toEqual({
      curve: "P-521",
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "EC",
    });

    expect(key.export("jwk")).toEqual({
      crv: "P-521",
      d: expect.any(String),
      kty: "EC",
      x: expect.any(String),
      y: expect.any(String),
    });

    expect(key.export("pem")).toEqual(TEST_EC_KEY_PEM);
  });

  test("should create from existing RAW key", async () => {
    const key = Kryptos.from("raw", TEST_EC_KEY_RAW);

    expect(key.export("b64")).toEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });

    expect(key.export("der")).toEqual({
      curve: "P-521",
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "EC",
    });

    expect(key.export("jwk")).toEqual({
      crv: "P-521",
      d: expect.any(String),
      kty: "EC",
      x: expect.any(String),
      y: expect.any(String),
    });

    expect(key.export("pem")).toEqual({
      curve: "P-521",
      privateKey: expect.any(String),
      publicKey: expect.any(String),
      type: "EC",
    });

    expect(key.export("raw")).toEqual({
      curve: "P-521",
      privateKey: expect.any(Buffer),
      publicKey: expect.any(Buffer),
      type: "EC",
    });

    const raw = key.export("raw");

    expect({
      curve: "P-521",
      privateKey: raw.privateKey!.toString("hex"),
      publicKey: raw.publicKey!.toString("hex"),
      type: "EC",
    }).toEqual({
      curve: "P-521",
      privateKey: TEST_EC_KEY_RAW.privateKey!.toString("hex"),
      publicKey: TEST_EC_KEY_RAW.publicKey!.toString("hex"),
      type: "EC",
    });
  });
});
