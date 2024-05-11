import { Kryptos } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { EnigmaError } from "../errors";
import { EnigmaKit } from "./EnigmaKit";

describe("EnigmaKit", () => {
  let kit: EnigmaKit;
  let hash: string;

  beforeEach(async () => {
    const secret = randomBytes(16).toString("hex");
    const kryptos = await Kryptos.generate("oct");

    kit = new EnigmaKit({
      aes: { kryptos },
      hmac: { secret },
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
