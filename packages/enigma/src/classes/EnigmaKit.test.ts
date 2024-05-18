import { TEST_OCT_KEY_ENC, TEST_OCT_KEY_SIG } from "../__fixtures__/keys";
import { EnigmaError } from "../errors";
import { EnigmaKit } from "./EnigmaKit";

describe("EnigmaKit", () => {
  let kit: EnigmaKit;
  let hash: string;

  beforeEach(async () => {
    kit = new EnigmaKit({
      aes: { kryptos: TEST_OCT_KEY_ENC },
      oct: { kryptos: TEST_OCT_KEY_SIG },
    });
    hash = await kit.hash("string");
  });

  test("should verify", async () => {
    await expect(kit.verify("string", hash)).resolves.toBe(true);
  });

  test("should reject", async () => {
    await expect(kit.verify("wrong", hash)).resolves.toBe(false);
  });

  test("should assert", async () => {
    await expect(kit.assert("string", hash)).resolves.not.toThrow();
  });

  test("should throw error", async () => {
    await expect(kit.assert("wrong", hash)).rejects.toThrow(EnigmaError);
  });
});
