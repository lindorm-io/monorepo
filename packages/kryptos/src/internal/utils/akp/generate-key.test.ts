import { generateAkpKey } from "./generate-key";

describe("generateAkpKey", () => {
  describe("sig", () => {
    test("should generate ML-DSA-44", () => {
      const res = generateAkpKey({ algorithm: "ML-DSA-44" });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate ML-DSA-65", () => {
      const res = generateAkpKey({ algorithm: "ML-DSA-65" });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate ML-DSA-87", () => {
      const res = generateAkpKey({ algorithm: "ML-DSA-87" });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });
  });
});
