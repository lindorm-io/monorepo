import { PUBLIC_RSA_JWK, PUBLIC_RSA_PEM } from "../../fixtures/rsa-keys.fixture";
import { getKeyType } from "./get-key-type";

describe("getKeyType", () => {
  test("should return key type for RSA pem", () => {
    expect(getKeyType(PUBLIC_RSA_PEM)).toBe("RSA");
  });

  test("should return key type for RSA jwk", () => {
    expect(getKeyType(PUBLIC_RSA_JWK)).toBe("RSA");
  });
});
