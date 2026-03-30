import { generateOkpKey } from "./generate-key";

describe("generateEcKey", () => {
  describe("enc", () => {
    test("should generate X25519", () => {
      const res = generateOkpKey({ algorithm: "ECDH-ES", curve: "X25519" });

      expect(res.curve).toEqual("X25519");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate X448", () => {
      const res = generateOkpKey({ algorithm: "ECDH-ES", curve: "X448" });

      expect(res.curve).toEqual("X448");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });
  });

  describe("sig", () => {
    test("should generate Ed25519", () => {
      const res = generateOkpKey({ algorithm: "EdDSA", curve: "Ed25519" });

      expect(res.curve).toEqual("Ed25519");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate Ed448", () => {
      const res = generateOkpKey({ algorithm: "EdDSA", curve: "Ed448" });

      expect(res.curve).toEqual("Ed448");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });
  });
});
