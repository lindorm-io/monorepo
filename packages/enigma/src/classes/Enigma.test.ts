import { KryptosKit } from "@lindorm/kryptos";
import { EnigmaError } from "../errors";
import { Enigma } from "./Enigma";

describe("Enigma", () => {
  let kit: Enigma;
  let hash: string;

  beforeEach(async () => {
    const enc = KryptosKit.make.enc.oct({ algorithm: "dir", encryption: "A256GCM" });
    const sig = KryptosKit.make.sig.oct({ algorithm: "HS256" });

    kit = new Enigma({ aes: { kryptos: enc }, oct: { kryptos: sig } });

    hash = await kit.hash("string");
  }, 10000);

  test("should verify", async () => {
    await expect(kit.verify("string", hash)).resolves.toEqual(true);
  }, 10000);

  test("should reject", async () => {
    await expect(kit.verify("wrong", hash)).resolves.toEqual(false);
  }, 10000);

  test("should assert", async () => {
    await expect(kit.assert("string", hash)).resolves.toBeUndefined();
  }, 10000);

  test("should throw error", async () => {
    await expect(kit.assert("wrong", hash)).rejects.toThrow(EnigmaError);
  }, 10000);
});
