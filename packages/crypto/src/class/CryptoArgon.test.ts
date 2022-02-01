import { CryptoArgon } from "./CryptoArgon";
import { CryptoError } from "../error";

describe("CryptoArgon", () => {
  let instance: CryptoArgon;
  let signature: string;

  describe("with default options", () => {
    beforeEach(async () => {
      instance = new CryptoArgon();
      signature = await instance.encrypt("string");
    });

    test("should generate signature", async () => {
      expect(signature.length).toBe(374);
    });

    test("should verify", async () => {
      await expect(instance.verify("string", signature)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(instance.verify("wrong", signature)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
    });
  });

  describe("with hashLength", () => {
    beforeEach(async () => {
      instance = new CryptoArgon({
        hashLength: 256,
      });
      signature = await instance.encrypt("string");
    });

    test("should generate signature", async () => {
      expect(signature.length).toBe(545);
    });

    test("should verify", async () => {
      await expect(instance.verify("string", signature)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(instance.verify("wrong", signature)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
    });
  });

  describe("with memoryCost", () => {
    beforeEach(async () => {
      instance = new CryptoArgon({
        memoryCost: 2,
      });
      signature = await instance.encrypt("string");
    });

    test("should generate signature", async () => {
      expect(signature.length).toBe(374);
    });

    test("should verify", async () => {
      await expect(instance.verify("string", signature)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(instance.verify("wrong", signature)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
    });
  });

  describe("with parallelism", () => {
    beforeEach(async () => {
      instance = new CryptoArgon({
        parallelism: 1,
      });
      signature = await instance.encrypt("string");
    });

    test("should generate signature", async () => {
      expect(signature.length).toBe(374);
    });

    test("should verify", async () => {
      await expect(instance.verify("string", signature)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(instance.verify("wrong", signature)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
    });
  });

  describe("with saltLength", () => {
    beforeEach(async () => {
      instance = new CryptoArgon({
        saltLength: 64,
      });
      signature = await instance.encrypt("string");
    });

    test("should generate signature", async () => {
      expect(signature.length).toBe(289);
    });

    test("should verify", async () => {
      await expect(instance.verify("string", signature)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(instance.verify("wrong", signature)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
    });
  });

  describe("with secret", () => {
    beforeEach(async () => {
      instance = new CryptoArgon({
        secret: "secret",
      });
      signature = await instance.encrypt("string");
    });

    test("should generate signature", async () => {
      expect(signature.length).toBe(374);
    });

    test("should verify", async () => {
      await expect(instance.verify("string", signature)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(instance.verify("wrong", signature)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
    });

    test("should reject on wrong secret", async () => {
      const instance2 = new CryptoArgon({
        secret: "wrong",
      });

      await expect(instance2.verify("string", signature)).resolves.toBe(false);
    });
  });

  describe("with timeCost", () => {
    beforeEach(async () => {
      instance = new CryptoArgon({
        timeCost: 4,
      });
      signature = await instance.encrypt("string");
    });

    test("should generate signature", async () => {
      expect(signature.length).toBe(373);
    });

    test("should verify", async () => {
      await expect(instance.verify("string", signature)).resolves.toBe(true);
    });

    test("should reject", async () => {
      await expect(instance.verify("wrong", signature)).resolves.toBe(false);
    });

    test("should throw error", async () => {
      await expect(instance.assert("wrong", signature)).rejects.toThrow(CryptoError);
    });
  });
});
