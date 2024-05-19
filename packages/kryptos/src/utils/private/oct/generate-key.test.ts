import { _generateOctKey } from "./generate-key";

describe("generateOctKey", () => {
  describe("enc", () => {
    describe("dir", () => {
      test("should generate A128GCM", () => {
        const res = _generateOctKey({
          algorithm: "dir",
          encryption: "A128GCM",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(16);
      });

      test("should generate A192GCM", () => {
        const res = _generateOctKey({
          algorithm: "dir",
          encryption: "A192GCM",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(24);
      });

      test("should generate A256GCM", () => {
        const res = _generateOctKey({
          algorithm: "dir",
          encryption: "A256GCM",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(32);
      });

      test("should generate A128CBC-HS256", () => {
        const res = _generateOctKey({
          algorithm: "dir",
          encryption: "A128CBC-HS256",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(48);
      });

      test("should generate A192CBC-HS384", () => {
        const res = _generateOctKey({
          algorithm: "dir",
          encryption: "A192CBC-HS384",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(72);
      });

      test("should generate A256CBC-HS512", () => {
        const res = _generateOctKey({
          algorithm: "dir",
          encryption: "A256CBC-HS512",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(96);
      });

      test("should generate A128KW", () => {
        const res = _generateOctKey({
          algorithm: "A128KW",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(16);
      });

      test("should generate A192KW", () => {
        const res = _generateOctKey({
          algorithm: "A192KW",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(24);
      });

      test("should generate A256KW", () => {
        const res = _generateOctKey({
          algorithm: "A256KW",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(32);
      });

      test("should generate PBES2-HS256+A128KW", () => {
        const res = _generateOctKey({
          algorithm: "PBES2-HS256+A128KW",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(16);
      });

      test("should generate PBES2-HS384+A192KW", () => {
        const res = _generateOctKey({
          algorithm: "PBES2-HS384+A192KW",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(24);
      });

      test("should generate PBES2-HS512+A256KW", () => {
        const res = _generateOctKey({
          algorithm: "PBES2-HS512+A256KW",
          type: "oct",
          use: "enc",
        });

        expect(res.privateKey).toEqual(expect.any(Buffer));
        expect(res.privateKey.length).toEqual(32);
      });
    });
  });

  describe("sig", () => {
    test("should generate HS256", () => {
      const res = _generateOctKey({
        algorithm: "HS256",
        type: "oct",
        use: "sig",
      });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.privateKey.length).toEqual(64);
    });

    test("should generate HS384", () => {
      const res = _generateOctKey({
        algorithm: "HS384",
        type: "oct",
        use: "sig",
      });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.privateKey.length).toEqual(96);
    });

    test("should generate HS512", () => {
      const res = _generateOctKey({
        algorithm: "HS512",
        type: "oct",
        use: "sig",
      });

      expect(res.privateKey).toEqual(expect.any(Buffer));
      expect(res.privateKey.length).toEqual(128);
    });
  });
});
