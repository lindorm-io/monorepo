import { KryptosEncAlgorithm, KryptosKit } from "@lindorm/kryptos";
import { decryptAes } from "./encryption";
import { prepareAesEncryption } from "./prepare-encryption";

describe("prepareAesEncryption", () => {
  describe("dir algorithm", () => {
    test("should have no headerParams values set", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams).toEqual({
        publicEncryptionJwk: undefined,
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionTag: undefined,
      });
    });

    test("should have no publicEncryptionKey", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.publicEncryptionKey).toBeUndefined();
    });

    test("should provide encrypt function", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(typeof prepared.encrypt).toBe("function");
    });
  });

  describe("A128KW / A256KW algorithms", () => {
    const algorithms: Array<KryptosEncAlgorithm> = ["A128KW", "A256KW"];

    test.each(algorithms)(
      "should have publicEncryptionKey present for %s",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });
        const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

        expect(prepared.publicEncryptionKey).toEqual(expect.any(Buffer));
      },
    );

    test.each(algorithms)("should have no special headerParams for %s", (algorithm) => {
      const kryptos = KryptosKit.generate.auto({ algorithm });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams).toEqual({
        publicEncryptionJwk: undefined,
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionTag: undefined,
      });
    });
  });

  describe("RSA-OAEP-256 algorithm", () => {
    test("should have publicEncryptionKey present", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "RSA-OAEP-256" });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.publicEncryptionKey).toEqual(expect.any(Buffer));
    });

    test("should have no special headerParams", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "RSA-OAEP-256" });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams).toEqual({
        publicEncryptionJwk: undefined,
        pbkdfIterations: undefined,
        pbkdfSalt: undefined,
        publicEncryptionIv: undefined,
        publicEncryptionTag: undefined,
      });
    });
  });

  describe("ECDH-ES / ECDH-ES+A128KW algorithms", () => {
    const algorithms: Array<KryptosEncAlgorithm> = ["ECDH-ES", "ECDH-ES+A128KW"];

    test.each(algorithms)(
      "should have headerParams.publicEncryptionJwk present for %s",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });
        const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

        expect(prepared.headerParams.publicEncryptionJwk).toEqual(
          expect.objectContaining({
            crv: expect.any(String),
            kty: expect.any(String),
            x: expect.any(String),
          }),
        );
      },
    );

    test.each(algorithms)(
      "should have other headerParams undefined for %s",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });
        const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

        expect(prepared.headerParams.pbkdfIterations).toBeUndefined();
        expect(prepared.headerParams.pbkdfSalt).toBeUndefined();
        expect(prepared.headerParams.publicEncryptionIv).toBeUndefined();
        expect(prepared.headerParams.publicEncryptionTag).toBeUndefined();
      },
    );
  });

  describe("PBES2-HS256+A128KW algorithm", () => {
    test("should have headerParams.pbkdfSalt present", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "PBES2-HS256+A128KW" });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams.pbkdfSalt).toEqual(expect.any(Buffer));
    });

    test("should have headerParams.pbkdfIterations present", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "PBES2-HS256+A128KW" });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams.pbkdfIterations).toEqual(expect.any(Number));
      expect(prepared.headerParams.pbkdfIterations).toBeGreaterThan(0);
    });

    test("should have other headerParams undefined", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "PBES2-HS256+A128KW" });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams.publicEncryptionJwk).toBeUndefined();
      expect(prepared.headerParams.publicEncryptionIv).toBeUndefined();
      expect(prepared.headerParams.publicEncryptionTag).toBeUndefined();
    });
  });

  describe("A128GCMKW algorithm", () => {
    test("should have headerParams.publicEncryptionIv present", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128GCMKW" });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams.publicEncryptionIv).toEqual(expect.any(Buffer));
    });

    test("should have headerParams.publicEncryptionTag present", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128GCMKW" });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams.publicEncryptionTag).toEqual(expect.any(Buffer));
    });

    test("should have other headerParams undefined", () => {
      const kryptos = KryptosKit.generate.auto({ algorithm: "A128GCMKW" });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect(prepared.headerParams.publicEncryptionJwk).toBeUndefined();
      expect(prepared.headerParams.pbkdfIterations).toBeUndefined();
      expect(prepared.headerParams.pbkdfSalt).toBeUndefined();
    });
  });

  describe("encrypt closure functionality", () => {
    const algorithms: Array<KryptosEncAlgorithm> = [
      "dir",
      "A128KW",
      "A256KW",
      "RSA-OAEP-256",
      "ECDH-ES",
      "ECDH-ES+A128KW",
      "PBES2-HS256+A128KW",
      "A128GCMKW",
    ];

    test.each(algorithms)(
      "should produce valid ciphertext that decryptAes can decrypt for %s",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });
        const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

        const encryptResult = prepared.encrypt("test data");

        expect(encryptResult).toEqual({
          authTag: expect.any(Buffer),
          content: expect.any(Buffer),
          contentType: "text/plain",
          initialisationVector: expect.any(Buffer),
        });

        const decrypted = decryptAes({
          ...encryptResult,
          ...prepared.headerParams,
          publicEncryptionKey: prepared.publicEncryptionKey,
          kryptos,
          encryption: "A256GCM",
        });

        expect(decrypted).toEqual("test data");
      },
    );

    test.each(algorithms)("should support AAD in encrypt closure for %s", (algorithm) => {
      const kryptos = KryptosKit.generate.auto({ algorithm });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });
      const aad = Buffer.from("additional-authenticated-data");

      const encryptResult = prepared.encrypt("test data", { aad });

      const decrypted = decryptAes({
        ...encryptResult,
        ...prepared.headerParams,
        publicEncryptionKey: prepared.publicEncryptionKey,
        aad,
        kryptos,
        encryption: "A256GCM",
      });

      expect(decrypted).toEqual("test data");
    });

    test.each(algorithms)(
      "should require same AAD to decrypt when encrypted with AAD for %s",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });
        const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });
        const aad = Buffer.from("additional-authenticated-data");

        const encryptResult = prepared.encrypt("test data", { aad });

        // Should fail without AAD
        expect(() =>
          decryptAes({
            ...encryptResult,
            ...prepared.headerParams,
            publicEncryptionKey: prepared.publicEncryptionKey,
            kryptos,
            encryption: "A256GCM",
          }),
        ).toThrow();

        // Should fail with wrong AAD
        expect(() =>
          decryptAes({
            ...encryptResult,
            ...prepared.headerParams,
            publicEncryptionKey: prepared.publicEncryptionKey,
            aad: Buffer.from("wrong-aad"),
            kryptos,
            encryption: "A256GCM",
          }),
        ).toThrow();
      },
    );
  });

  describe("CEK security", () => {
    test("should not expose contentEncryptionKey in returned object", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      const keys = Object.keys(prepared);

      expect(keys).toEqual(["headerParams", "publicEncryptionKey", "encrypt"]);
      expect(keys).not.toContain("contentEncryptionKey");
    });

    test("should not have contentEncryptionKey property", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const prepared = prepareAesEncryption({ encryption: "A256GCM", kryptos });

      expect((prepared as any).contentEncryptionKey).toBeUndefined();
    });
  });

  describe("default encryption", () => {
    test("should default to A256GCM when no encryption specified", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A256GCM",
      });
      const prepared = prepareAesEncryption({ kryptos });

      const encryptResult = prepared.encrypt("test data");

      // Should be able to decrypt with A256GCM
      const decrypted = decryptAes({
        ...encryptResult,
        kryptos,
        encryption: "A256GCM",
      });

      expect(decrypted).toEqual("test data");
    });
  });
});
