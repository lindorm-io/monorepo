import { randomBytes } from "crypto";
import { CryptoError } from "../errors";
import { CryptoSecret } from "./CryptoSecret";

describe("CryptoSecret", () => {
  let instance: CryptoSecret;
  let signature: string;

  beforeEach(() => {
    const secret = randomBytes(16).toString("hex");

    instance = new CryptoSecret({
      aes: { secret },
      hmac: { secret },
    });
    signature = instance.sign("string");
  });

  test("should verify", async () => {
    expect(instance.verify("string", signature)).toBe(true);
  });

  test("should reject", async () => {
    expect(instance.verify("wrong", signature)).toBe(false);
  });

  test("should assert", async () => {
    expect(() => instance.assert("string", signature)).not.toThrow();
  });

  test("should throw error", async () => {
    expect(() => instance.assert("wrong", signature)).toThrow(CryptoError);
  });
});
