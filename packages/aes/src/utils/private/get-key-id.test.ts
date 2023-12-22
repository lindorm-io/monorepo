import { PUBLIC_RSA_JWK, PUBLIC_RSA_PEM } from "../../fixtures/rsa-keys.fixture";
import { getKeyId } from "./get-key-id";

describe("getKeyId", () => {
  test("should return undefined", () => {
    expect(getKeyId()).toBe(undefined);
  });

  test("should return key id for RSA pem", () => {
    expect(getKeyId(PUBLIC_RSA_PEM)).toBe("3a0b5b82-73d5-5f80-9591-0d37551bcd83");
  });

  test("should return key id for RSA jwk", () => {
    expect(getKeyId(PUBLIC_RSA_JWK)).toBe("3a0b5b82-73d5-5f80-9591-0d37551bcd83");
  });
});
