import { PUBLIC_EC_JWK } from "../../../fixtures/ec-keys.fixture";
import { getJwkFromBuffer, getPublicKeyBuffer } from "./jwk-buffer";

describe("get-jwk-buffer", () => {
  test("should return public key buffer", () => {
    expect(getPublicKeyBuffer(PUBLIC_EC_JWK)).toStrictEqual(expect.any(Buffer));
  });

  test("should return private key buffer", () => {
    expect(getPublicKeyBuffer(PUBLIC_EC_JWK)).toStrictEqual(expect.any(Buffer));
  });

  test("should return public key buffer as jwk", () => {
    const buffer = getPublicKeyBuffer(PUBLIC_EC_JWK);

    expect(getJwkFromBuffer(PUBLIC_EC_JWK.crv, buffer)).toStrictEqual({
      crv: "P-521",
      x: PUBLIC_EC_JWK.x,
      y: PUBLIC_EC_JWK.y,
    });
  });
});
