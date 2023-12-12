import { CryptoError } from "../errors";
import { CryptoSha } from "./CryptoSha";

describe("CryptoSha", () => {
  let instance: CryptoSha;
  let hash: string;

  beforeEach(() => {
    instance = new CryptoSha();
    hash = instance.hash("string");
  });

  test("should verify", () => {
    expect(instance.verify("string", hash)).toBe(true);
  });

  test("should reject", () => {
    expect(instance.verify("wrong", hash)).toBe(false);
  });

  test("should assert", () => {
    expect(() => instance.assert("string", hash)).not.toThrow();
  });

  test("should throw error", () => {
    expect(() => instance.assert("wrong", hash)).toThrow(CryptoError);
  });
});
