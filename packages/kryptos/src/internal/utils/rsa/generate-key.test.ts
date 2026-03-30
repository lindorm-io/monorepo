import { generateRsaKey } from "./generate-key";

describe("generateOctKey", () => {
  describe("enc", () => {
    test("should generate RSA-OAEP", () => {
      const res = generateRsaKey({ algorithm: "RSA-OAEP" });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    }, 20000);

    test("should generate RSA-OAEP-256", () => {
      const res = generateRsaKey({ algorithm: "RSA-OAEP-256" });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    }, 20000);

    test("should generate RSA-OAEP-384", () => {
      const res = generateRsaKey({ algorithm: "RSA-OAEP-384" });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    }, 20000);

    test("should generate RSA-OAEP-512", () => {
      const res = generateRsaKey({ algorithm: "RSA-OAEP-512" });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    }, 20000);
  });

  describe("sig", () => {
    describe("RS", () => {
      test("should generate RS256", () => {
        const res = generateRsaKey({ algorithm: "RS256" });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);

      test("should generate RS384", () => {
        const res = generateRsaKey({ algorithm: "RS384" });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);

      test("should generate RS512", () => {
        const res = generateRsaKey({ algorithm: "RS512" });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);
    });

    describe("PS", () => {
      test("should generate PS256", () => {
        const res = generateRsaKey({ algorithm: "PS256" });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);

      test("should generate PS384", () => {
        const res = generateRsaKey({ algorithm: "PS384" });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);

      test("should generate PS512", () => {
        const res = generateRsaKey({ algorithm: "PS512" });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);
    });
  });
});
