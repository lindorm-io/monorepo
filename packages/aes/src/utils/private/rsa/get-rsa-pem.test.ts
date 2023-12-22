import { PRIVATE_RSA_JWK } from "../../../fixtures/rsa-jwks.fixture";
import { PRIVATE_RSA_PEM } from "../../../fixtures/rsa-keys.fixture";
import { getRsaPem } from "./get-rsa-pem";

describe("getRsaPem", () => {
  test("should return RSA pem", () => {
    expect(getRsaPem(PRIVATE_RSA_PEM)).toBe(PRIVATE_RSA_PEM);
  });

  test("should return RSA jwk", () => {
    expect(getRsaPem(PRIVATE_RSA_JWK)).toStrictEqual(expect.objectContaining(PRIVATE_RSA_PEM));
  });
});
