import { CryptoError } from "../errors";
import { CryptoHmac } from "./CryptoHmac";

describe("CryptoHmac", () => {
  let instance: CryptoHmac;
  let signature: string;

  beforeEach(() => {
    instance = new CryptoHmac({
      secret: "mock-secret",
    });
    signature = instance.sign("string");
  });

  test("should verify", () => {
    expect(instance.verify("string", signature)).toBe(true);
  });

  test("should reject", () => {
    expect(instance.verify("wrong", signature)).toBe(false);
  });

  test("should assert", () => {
    expect(() => instance.assert("string", signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => instance.assert("wrong", signature)).toThrow(CryptoError);
  });
});
