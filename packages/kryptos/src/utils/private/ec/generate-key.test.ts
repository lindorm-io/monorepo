import { generateEcKey } from "./generate-key";

describe("generateEcKey", () => {
  describe("enc", () => {
    test("should generate ECDH-ES", () => {
      const res = generateEcKey({
        algorithm: "ECDH-ES",
        type: "EC",
        use: "enc",
      });

      expect(res.curve).toEqual("P-256");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate ECDH-ES+A128KW", () => {
      const res = generateEcKey({
        algorithm: "ECDH-ES+A128KW",
        type: "EC",
        use: "enc",
      });

      expect(res.curve).toEqual("P-256");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate ECDH-ES+A192KW", () => {
      const res = generateEcKey({
        algorithm: "ECDH-ES+A192KW",
        type: "EC",
        use: "enc",
      });

      expect(res.curve).toEqual("P-384");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate ECDH-ES+A256KW", () => {
      const res = generateEcKey({
        algorithm: "ECDH-ES+A256KW",
        type: "EC",
        use: "enc",
      });

      expect(res.curve).toEqual("P-521");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });
  });

  describe("sig", () => {
    test("should generate ES256", () => {
      const res = generateEcKey({
        algorithm: "ES256",
        type: "EC",
        use: "sig",
      });

      expect(res.curve).toEqual("P-256");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate ES384", () => {
      const res = generateEcKey({
        algorithm: "ES384",
        type: "EC",
        use: "sig",
      });

      expect(res.curve).toEqual("P-384");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });

    test("should generate ES512", () => {
      const res = generateEcKey({
        algorithm: "ES512",
        type: "EC",
        use: "sig",
      });

      expect(res.curve).toEqual("P-521");
      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    });
  });
});
