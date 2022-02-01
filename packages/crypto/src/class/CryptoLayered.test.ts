import { CryptoLayered } from "./CryptoLayered";
import { CryptoError } from "../error";

describe("CryptoLayered", () => {
  let instance: CryptoLayered;
  let signature: string;

  beforeEach(async () => {
    instance = new CryptoLayered({
      aes: { secret: "mock-secret" },
      sha: { secret: "mock-secret" },
    });
    signature = await instance.encrypt("string");
  });

  test("should verify", async () => {
    await expect(instance.verify("string", signature)).resolves.toBe(true);
  });

  test("should reject", async () => {
    await expect(instance.verify("wrong", signature)).resolves.toBe(false);
  });

  test("should assert", async () => {
    await expect(instance.assert("string", signature)).resolves.toBeUndefined();
  });

  test("should throw error", async () => {
    await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
  });
});
