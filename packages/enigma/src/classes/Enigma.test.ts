import { Kryptos } from "@lindorm/kryptos";
import { EnigmaError } from "../errors";
import { Enigma } from "./Enigma";

describe("Enigma", () => {
  let kit: Enigma;
  let hash: string;

  beforeEach(async () => {
    const enc = Kryptos.generate({
      algorithm: "dir",
      encryption: "A256GCM",
      type: "oct",
      use: "enc",
    });

    const sig = Kryptos.generate({
      algorithm: "HS256",
      type: "oct",
      use: "sig",
    });

    kit = new Enigma({
      aes: { kryptos: enc },
      oct: { kryptos: sig },
    });

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
