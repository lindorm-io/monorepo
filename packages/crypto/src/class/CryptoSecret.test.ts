import { CryptoSecret } from "./CryptoSecret";
import { CryptoError } from "../error";

describe("CryptoSecret", () => {
  let instance: CryptoSecret;
  let signature: string;

  beforeEach(() => {
    instance = new CryptoSecret({
      aes: { secret: "mock-secret" },
      sha: { secret: "mock-secret" },
    });
    signature = instance.encrypt("string");
  });

  test("should verify", async () => {
    expect(instance.verify("string", signature)).toBe(true);
  });

  test("should reject", async () => {
    expect(instance.verify("wrong", signature)).toBe(false);
  });

  test("should assert", async () => {
    expect(instance.assert("string", signature)).toBeUndefined();
  });

  test("should throw error", async () => {
    expect(() => instance.assert("wrong", signature)).toThrow(CryptoError);
  });
});
