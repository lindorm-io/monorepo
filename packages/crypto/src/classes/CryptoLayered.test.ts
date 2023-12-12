import { randomBytes } from "crypto";
import { CryptoError } from "../errors";
import { CryptoLayered } from "./CryptoLayered";

describe("CryptoLayered", () => {
  let instance: CryptoLayered;
  let signature: string;

  beforeEach(async () => {
    const secret = randomBytes(16).toString("hex");

    instance = new CryptoLayered({
      aes: { secret },
      hmac: { secret },
    });
    signature = await instance.sign("string");
  });

  test("should verify", async () => {
    await expect(instance.verify("string", signature)).resolves.toBe(true);
  });

  test("should reject", async () => {
    await expect(instance.verify("wrong", signature)).resolves.toBe(false);
  });

  test("should assert", async () => {
    await expect(instance.assert("string", signature)).resolves.not.toThrow();
  });

  test("should throw error", async () => {
    await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
  });
});
