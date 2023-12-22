import { PRIVATE_RSA_JWK, PUBLIC_RSA_JWK } from "../../fixtures/rsa-jwks.fixture";
import { PRIVATE_RSA_PEM, PUBLIC_RSA_PEM } from "../../fixtures/rsa-keys.fixture";
import { isPublicKey } from "./is-public-key";

describe("isPublicKey", () => {
  test("should return true with public RSA pem", () => {
    expect(isPublicKey(PUBLIC_RSA_PEM)).toBe(true);
  });

  test("should return true with public RSA jwk", () => {
    expect(isPublicKey(PUBLIC_RSA_JWK)).toBe(true);
  });

  test("should return false with private RSA pem", () => {
    expect(isPublicKey(PRIVATE_RSA_PEM)).toBe(false);
  });

  test("should return false with private RSA jwk", () => {
    expect(isPublicKey(PRIVATE_RSA_JWK)).toBe(false);
  });
});
