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
    }, 10000);

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    }, 10000);

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    }, 10000);

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    }, 10000);
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
    }, 10000);

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    }, 10000);

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    }, 10000);

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    }, 10000);
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
    }, 10000);

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    }, 10000);

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    }, 10000);

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    }, 10000);
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
    }, 10000);

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    }, 10000);

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    }, 10000);

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    }, 10000);
  });

  describe("with secret", () => {
    beforeEach(async () => {
      kit = new ArgonKit({ kryptos: TEST_OCT_KEY_SIG });
      hash = await kit.hash("string");
    });

    test("should generate hash", async () => {
      expect(hash.length).toBe(397);
    }, 10000);

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    }, 10000);

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    }, 10000);

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    }, 10000);

    test("should reject on wrong secret", async () => {
      const kryptos = Kryptos.generate({
        algorithm: "dir",
        encryption: "A256GCM",
        type: "oct",
        use: "enc",
      });

      const kit2 = new ArgonKit({ kryptos });

      await expect(kit2.verify("string", hash)).resolves.toBe(false);
    }, 10000);
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
    }, 10000);

    test("should verify", async () => {
      await expect(kit.verify("string", hash)).resolves.toBe(true);
    }, 10000);

    test("should reject", async () => {
      await expect(kit.verify("wrong", hash)).resolves.toBe(false);
    }, 10000);

    test("should throw error", async () => {
      await expect(kit.assert("wrong", hash)).rejects.toThrow(ArgonError);
    }, 10000);
  });
});
