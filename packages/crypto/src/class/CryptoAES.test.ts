import { CryptoAES } from "./CryptoAES";
import { CryptoError } from "../error";

describe("CryptoAES", () => {
  let instance: CryptoAES;
  let signature: string;

  beforeEach(() => {
    instance = new CryptoAES({ secret: "mock-secret" });
    signature = instance.encrypt("string");
  });

  test("should decrypt", () => {
    expect(instance.decrypt(signature)).toBe("string");
  });

  test("should verify", () => {
    expect(instance.verify("string", signature)).toBe(true);
  });

  test("should reject", () => {
    expect(instance.verify("wrong", signature)).toBe(false);
  });

  test("should assert", () => {
    expect(instance.assert("string", signature)).toBeUndefined();
  });

  test("should throw error", () => {
    expect(() => instance.assert("wrong", signature)).toThrow(CryptoError);
  });
});
