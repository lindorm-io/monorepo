import { Kryptos } from "@lindorm/kryptos";
import { TEST_OCT_KEY_SIG } from "../__fixtures__/keys";
import { ArgonError } from "../errors";
import { ArgonKit } from "./ArgonKit";

describe("ArgonKit", () => {
  let kit: ArgonKit;
  let hash: string;

  describe("with default options", () => {
    beforeEach(async () => {
      kit = new ArgonKit();
      hash = await kit.hash("string");
    });

    test("should generate hash", async () => {
      expect(hash.length).toBe(397);
    });

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    });
  });

  describe("with hashLength", () => {
    beforeEach(async () => {
      kit = new ArgonKit({
        hashLength: 128,
      });
      hash = await kit.hash("string");
    });

    test("should generate hash", async () => {
      expect(hash.length).toBe(226);
    });

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    });
  });

  describe("with memoryCost", () => {
    beforeEach(async () => {
      kit = new ArgonKit({
        memoryCost: 2048,
      });
      hash = await kit.hash("string");
    });

    test("should generate hash", async () => {
      expect(hash.length).toBe(396);
    });

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    });
  });

  describe("with parallelism", () => {
    beforeEach(async () => {
      kit = new ArgonKit({
        parallelism: 16,
      });
      hash = await kit.hash("string");
    });

    test("should generate hash", async () => {
      expect(hash.length).toBe(398);
    });

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    });
  });

  describe("with secret", () => {
    beforeEach(async () => {
      kit = new ArgonKit({ kryptos: TEST_OCT_KEY_SIG });
      hash = await kit.hash("string");
    });

    test("should generate hash", async () => {
      expect(hash.length).toBe(397);
    });

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    });

    test("should reject on wrong secret", async () => {
      const kryptos = Kryptos.generate({ type: "oct", use: "sig", size: 64 });
      const kit2 = new ArgonKit({ kryptos });

      await expect(kit2.verify("string", hash)).resolves.toBe(false);
    });
  });

  describe("with timeCost", () => {
    beforeEach(async () => {
      kit = new ArgonKit({
        timeCost: 16,
      });
      hash = await kit.hash("string");
    });

    test("should generate hash", async () => {
      expect(hash.length).toBe(397);
    });

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    });
  });
});
