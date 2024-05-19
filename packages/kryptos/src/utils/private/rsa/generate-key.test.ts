import { _generateRsaKey } from "./generate-key";

describe("generateOctKey", () => {
  describe("enc", () => {
    test("should generate RSA-OAEP", () => {
      const res = _generateRsaKey({
        algorithm: "RSA-OAEP",
        type: "RSA",
        use: "enc",
      });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    }, 20000);

    test("should generate RSA-OAEP-256", () => {
      const res = _generateRsaKey({
        algorithm: "RSA-OAEP-256",
        type: "RSA",
        use: "enc",
      });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    }, 20000);

    test("should generate RSA-OAEP-384", () => {
      const res = _generateRsaKey({
        algorithm: "RSA-OAEP-384",
        type: "RSA",
        use: "enc",
      });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    }, 20000);

    test("should generate RSA-OAEP-512", () => {
      const res = _generateRsaKey({
        algorithm: "RSA-OAEP-512",
        type: "RSA",
        use: "enc",
      });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.publicKey).toEqual(expect.any(Buffer));
    }, 20000);
  });

  describe("sig", () => {
    describe("RS", () => {
      test("should generate RS256", () => {
        const res = _generateRsaKey({
          algorithm: "RS256",
          type: "RSA",
          use: "sig",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);

      test("should generate RS384", () => {
        const res = _generateRsaKey({
          algorithm: "RS384",
          type: "RSA",
          use: "sig",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);

      test("should generate RS512", () => {
        const res = _generateRsaKey({
          algorithm: "RS512",
          type: "RSA",
          use: "sig",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);
    });

    describe("PS", () => {
      test("should generate PS256", () => {
        const res = _generateRsaKey({
          algorithm: "PS256",
          type: "RSA",
          use: "sig",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);

      test("should generate PS384", () => {
        const res = _generateRsaKey({
          algorithm: "PS384",
          type: "RSA",
          use: "sig",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);

      test("should generate PS512", () => {
        const res = _generateRsaKey({
          algorithm: "PS512",
          type: "RSA",
          use: "sig",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.publicKey).toEqual(expect.any(Buffer));
      }, 20000);
    });
  });
});
