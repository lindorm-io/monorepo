import {
  IKryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
  KryptosKit,
} from "@lindorm/kryptos";
import { IAesKit } from "../interfaces";
import { AesEncryptionMode } from "../types";
import { AesKit } from "./AesKit";

describe("AesKit", () => {
  const modes: Record<AesEncryptionMode, any> = {
    encoded: String,
    record: Object,
    tokenised: String,
    serialised: Object,
  };

  const algorithms: Array<KryptosEncAlgorithm> = [
    // EC / OKP
    "ECDH-ES",
    "ECDH-ES+A128KW",
    "ECDH-ES+A128GCMKW",
    // oct
    "A128KW",
    "A128GCMKW",
    "PBES2-HS256+A128KW",
    // RSA
    "RSA-OAEP-256",
  ];

  const encryptions: Array<KryptosEncryption> = [
    // CBC
    "A128CBC-HS256",
    // GCM
    "A128GCM",
  ];

  describe.each(algorithms)("algorithm: %s", (algorithm) => {
    let kryptos: IKryptos;

    beforeEach(async () => {
      kryptos = KryptosKit.generate.auto({ algorithm });
    });

    describe.each(encryptions)("encryption: %s", (encryption) => {
      let aesKit: IAesKit;

      beforeEach(async () => {
        aesKit = new AesKit({ kryptos, encryption });
      });

      describe.each(Object.entries(modes))("mode: %s", (mode, type) => {
        test("should encrypt", () => {
          expect(aesKit.encrypt("test", mode as any)).toEqual(expect.any(type));
        });

        test("should decrypt", () => {
          const encrypted = aesKit.encrypt("test", mode as any);

          expect(aesKit.decrypt(encrypted)).toEqual("test");
        });

        test("should verify", () => {
          const encrypted = aesKit.encrypt("test", mode as any);

          expect(aesKit.verify("test", encrypted)).toEqual(true);
        });

        test("should assert", () => {
          const encrypted = aesKit.encrypt("test", mode as any);

          expect(() => aesKit.assert("test", encrypted)).not.toThrow();
        });

        test("should throw", () => {
          const encrypted = aesKit.encrypt("test", mode as any);

          expect(() => aesKit.assert("invalid", encrypted)).toThrow();
        });
      });
    });
  });

  describe("Content type round-trip tests", () => {
    let kryptos: IKryptos;
    let aesKit: IAesKit;

    beforeEach(() => {
      kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128KW" });
      aesKit = new AesKit({ kryptos, encryption: "A128GCM" });
    });

    test("should encrypt and decrypt objects", () => {
      const data = { key: "value", nested: { deep: true } };
      const encrypted = aesKit.encrypt(data, "encoded");

      expect(aesKit.decrypt(encrypted)).toEqual(data);
    });

    test("should encrypt and decrypt arrays", () => {
      const data = [1, "two", { three: 3 }];
      const encrypted = aesKit.encrypt(data, "encoded");

      expect(aesKit.decrypt(encrypted)).toEqual(data);
    });

    test("should encrypt and decrypt numbers", () => {
      const data = 42;
      const encrypted = aesKit.encrypt(data, "encoded");

      expect(aesKit.decrypt(encrypted)).toEqual(data);
    });

    test("should encrypt and decrypt floats", () => {
      const data = 3.14;
      const encrypted = aesKit.encrypt(data, "encoded");

      expect(aesKit.decrypt(encrypted)).toEqual(data);
    });

    test("should encrypt and decrypt buffers", () => {
      const data = Buffer.from("binary data");
      const encrypted = aesKit.encrypt(data, "encoded");

      expect(aesKit.decrypt(encrypted)).toEqual(data);
    });

    test("should encrypt and decrypt empty strings", () => {
      const data = "";
      const encrypted = aesKit.encrypt(data, "encoded");

      expect(aesKit.decrypt(encrypted)).toEqual(data);
    });
  });

  describe("Static method tests", () => {
    describe("contentType", () => {
      test("should return text/plain for string", () => {
        expect(AesKit.contentType("hello")).toEqual("text/plain");
      });

      test("should return application/octet-stream for Buffer", () => {
        expect(AesKit.contentType(Buffer.from("data"))).toEqual(
          "application/octet-stream",
        );
      });

      test("should return application/json for object", () => {
        expect(AesKit.contentType({ key: "value" })).toEqual("application/json");
      });

      test("should return application/json for array", () => {
        expect(AesKit.contentType([1, 2, 3])).toEqual("application/json");
      });

      test("should return application/json for number", () => {
        expect(AesKit.contentType(42)).toEqual("application/json");
      });
    });

    describe("isAesTokenised", () => {
      test("should return true for valid tokenised string", () => {
        const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128KW" });
        const aesKit = new AesKit({ kryptos, encryption: "A128GCM" });
        const tokenised = aesKit.encrypt("test", "tokenised");

        expect(AesKit.isAesTokenised(tokenised)).toEqual(true);
      });

      test("should return false for regular string", () => {
        expect(AesKit.isAesTokenised("regular string")).toEqual(false);
      });
    });

    describe("parse", () => {
      test("should return same object for already-parsed AesDecryptionRecord", () => {
        const record = {
          content: Buffer.from("encrypted"),
          encryption: "A128GCM" as const,
          initialisationVector: Buffer.from("initialization-vector"),
          authTag: Buffer.from("auth-tag"),
        };

        expect(AesKit.parse(record)).toEqual(record);
      });
    });
  });

  describe("Constructor defaults", () => {
    test("should use kryptos encryption when no encryption specified", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "A128KW",
        encryption: "A192GCM",
      });
      const aesKit = new AesKit({ kryptos });
      const encrypted = aesKit.encrypt("test", "record");

      expect(encrypted.encryption).toEqual("A192GCM");
    });

    test("should default to A256GCM when no encryption specified and kryptos has none", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128KW" });
      const aesKit = new AesKit({ kryptos });
      const encrypted = aesKit.encrypt("test", "record");

      expect(encrypted.encryption).toEqual("A256GCM");
    });
  });

  describe("verify() edge cases", () => {
    let kryptos: IKryptos;
    let aesKit: IAesKit;

    beforeEach(() => {
      kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128KW" });
      aesKit = new AesKit({ kryptos, encryption: "A128GCM" });
    });

    test("should return false for wrong content", () => {
      const encrypted = aesKit.encrypt("correct", "encoded");

      expect(aesKit.verify("wrong", encrypted)).toEqual(false);
    });

    test("should return false for corrupted cipher data", () => {
      const encrypted = aesKit.encrypt("test", "record");
      const corrupted = {
        ...encrypted,
        content: Buffer.from("corrupted-data"),
      };

      expect(aesKit.verify("test", corrupted)).toEqual(false);
    });
  });

  describe("Invalid encryption mode", () => {
    let kryptos: IKryptos;
    let aesKit: IAesKit;

    beforeEach(() => {
      kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128KW" });
      aesKit = new AesKit({ kryptos, encryption: "A128GCM" });
    });

    test("should throw AesError for invalid mode", () => {
      expect(() => aesKit.encrypt("test", "invalid" as any)).toThrow(
        "Invalid encryption mode",
      );
    });
  });
});
