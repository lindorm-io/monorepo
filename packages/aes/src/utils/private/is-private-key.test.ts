import { PRIVATE_RSA_KEY, PUBLIC_RSA_KEY } from "../../fixtures/rsa-keys.fixture";
import { isPrivateKey } from "./is-private-key";

describe("isPrivateKey", () => {
  test("should return true with private key", () => {
    expect(isPrivateKey(PRIVATE_RSA_KEY)).toBe(true);
  });

  test("should return false with public key", () => {
    expect(isPrivateKey(PUBLIC_RSA_KEY)).toBe(false);
  });
});
