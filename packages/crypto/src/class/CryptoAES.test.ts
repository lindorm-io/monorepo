import { randomBytes } from "crypto";
import { CryptoError } from "../error";
import { CryptoAes } from "./CryptoAes";

describe("CryptoAes", () => {
  let instance: CryptoAes;
  let signature: string;

  beforeEach(() => {
    const secret = randomBytes(16).toString("hex");
    instance = new CryptoAes({ secret });
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
    expect(() => instance.assert("string", signature)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => instance.assert("wrong", signature)).toThrow(CryptoError);
  });
});
