import {
  type IKryptos,
  type KryptosEncAlgorithm,
  type KryptosEncryption,
  KryptosKit,
} from "@lindorm/kryptos";
import type { IAesKit } from "../interfaces/index.js";
import type { AesDecryptionRecord, AesEncryptionMode } from "../types/index.js";
import { AesKit } from "./AesKit.js";
import { beforeEach, describe, expect, test } from "vitest";

describe("AesKit", () => {
  const modes: Record<AesEncryptionMode, any> = {
    cbor: String,
    record: Object,
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
    // The KEY declares the content encryption, so the matrix varies it on the
    // key rather than on the kit — the kit would not honour it there.
    describe.each(encryptions)("encryption: %s", (encryption) => {
      let kryptos: IKryptos;
      let aesKit: IAesKit;

      beforeEach(async () => {
        kryptos = KryptosKit.generate.auto({ algorithm, encryption });
        aesKit = new AesKit({ kryptos });
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

  describe("prepareEncryption()", () => {
    let kryptos: IKryptos;
    let aesKit: IAesKit;

    beforeEach(() => {
      kryptos = KryptosKit.generate.enc.oct({
        algorithm: "A128KW",
        encryption: "A128GCM",
      });
      aesKit = new AesKit({ kryptos });
    });

    test("should return object with headerParams, publicEncryptionKey, and encrypt function", () => {
      const prepared = aesKit.prepareEncryption();

      expect(prepared).toEqual({
        headerParams: expect.any(Object),
        publicEncryptionKey: expect.any(Buffer),
        encrypt: expect.any(Function),
      });
    });

    test("should have headerParams as object", () => {
      const prepared = aesKit.prepareEncryption();

      expect(prepared.headerParams).toHaveProperty("publicEncryptionJwk");
      expect(prepared.headerParams).toHaveProperty("pbkdfIterations");
      expect(prepared.headerParams).toHaveProperty("pbkdfSalt");
      expect(prepared.headerParams).toHaveProperty("publicEncryptionIv");
      expect(prepared.headerParams).toHaveProperty("publicEncryptionTag");
    });

    test("should produce valid ciphertext from encrypt closure", () => {
      const prepared = aesKit.prepareEncryption();
      const result = prepared.encrypt("test data");

      expect(result).toEqual({
        authTag: expect.any(Buffer),
        content: expect.any(Buffer),
        contentType: "text/plain",
        initialisationVector: expect.any(Buffer),
      });
    });

    test("should round-trip with decrypt", () => {
      const prepared = aesKit.prepareEncryption();
      const encryptResult = prepared.encrypt("test data");

      const decryptionRecord: AesDecryptionRecord = {
        ...encryptResult,
        pbkdfIterations: prepared.headerParams.pbkdfIterations,
        pbkdfSalt: prepared.headerParams.pbkdfSalt,
        publicEncryptionIv: prepared.headerParams.publicEncryptionIv,
        publicEncryptionJwk: prepared.headerParams.publicEncryptionJwk,
        publicEncryptionTag: prepared.headerParams.publicEncryptionTag,
        publicEncryptionKey: prepared.publicEncryptionKey,
        encryption: "A128GCM",
        algorithm: kryptos.algorithm,
        keyId: kryptos.id,
        version: "1.0",
      };

      const decrypted = aesKit.decrypt(decryptionRecord);

      expect(decrypted).toEqual("test data");
    });

    test("should support AAD through prepareEncryption", () => {
      const prepared = aesKit.prepareEncryption();
      const aad = Buffer.from("additional-authenticated-data");

      const encryptResult = prepared.encrypt("test data", { aad });

      const decryptionRecord: AesDecryptionRecord = {
        ...encryptResult,
        pbkdfIterations: prepared.headerParams.pbkdfIterations,
        pbkdfSalt: prepared.headerParams.pbkdfSalt,
        publicEncryptionIv: prepared.headerParams.publicEncryptionIv,
        publicEncryptionJwk: prepared.headerParams.publicEncryptionJwk,
        publicEncryptionTag: prepared.headerParams.publicEncryptionTag,
        publicEncryptionKey: prepared.publicEncryptionKey,
        encryption: "A128GCM",
        algorithm: kryptos.algorithm,
        keyId: kryptos.id,
        version: "1.0",
      };

      const decrypted = aesKit.decrypt(decryptionRecord, { aad });

      expect(decrypted).toEqual("test data");
    });

    test("should fail to decrypt without AAD when encrypted with AAD", () => {
      const prepared = aesKit.prepareEncryption();
      const aad = Buffer.from("additional-authenticated-data");

      const encryptResult = prepared.encrypt("test data", { aad });

      const decryptionRecord: AesDecryptionRecord = {
        ...encryptResult,
        pbkdfIterations: prepared.headerParams.pbkdfIterations,
        pbkdfSalt: prepared.headerParams.pbkdfSalt,
        publicEncryptionIv: prepared.headerParams.publicEncryptionIv,
        publicEncryptionJwk: prepared.headerParams.publicEncryptionJwk,
        publicEncryptionTag: prepared.headerParams.publicEncryptionTag,
        publicEncryptionKey: prepared.publicEncryptionKey,
        encryption: "A128GCM",
        algorithm: kryptos.algorithm,
        keyId: kryptos.id,
        version: "1.0",
      };

      expect(() => aesKit.decrypt(decryptionRecord)).toThrow();
    });

    test("should work with different algorithms", () => {
      const algorithms: Array<KryptosEncAlgorithm> = [
        "dir",
        "ECDH-ES",
        "RSA-OAEP-256",
        "PBES2-HS256+A128KW",
      ];

      algorithms.forEach((algorithm) => {
        const k = KryptosKit.generate.auto({ algorithm, encryption: "A256GCM" });
        const kit = new AesKit({ kryptos: k });
        const prepared = kit.prepareEncryption();

        const encryptResult = prepared.encrypt("test");

        const decryptionRecord: AesDecryptionRecord = {
          ...encryptResult,
          pbkdfIterations: prepared.headerParams.pbkdfIterations,
          pbkdfSalt: prepared.headerParams.pbkdfSalt,
          publicEncryptionIv: prepared.headerParams.publicEncryptionIv,
          publicEncryptionJwk: prepared.headerParams.publicEncryptionJwk,
          publicEncryptionTag: prepared.headerParams.publicEncryptionTag,
          publicEncryptionKey: prepared.publicEncryptionKey,
          encryption: "A256GCM",
          algorithm: k.algorithm,
          keyId: k.id,
          version: "1.0",
        };

        const decrypted = kit.decrypt(decryptionRecord);

        expect(decrypted).toEqual("test");
      });
    });
  });

  // Compile-time surface: the @ts-expect-error lines are asserted by
  // `npm run typecheck`, not by the runtime run — vitest does not typecheck.
  describe("options surface (compile-time)", () => {
    const kryptos = KryptosKit.generate.auto({
      algorithm: "A128KW",
      encryption: "A128GCM",
    });
    const kit = new AesKit({ kryptos });

    const aad = Buffer.from("caller-supplied-aad");
    const apu = Buffer.from("Alice");
    const apv = Buffer.from("Bob");

    test("record mode takes a caller AAD; the header-derived modes reject one", () => {
      const record = kit.encrypt("payload", "record", { aad });

      // @ts-expect-error — cbor derives its AAD from the header; a caller AAD is not accepted
      kit.encrypt("payload", "cbor", { aad });

      // @ts-expect-error — serialised derives its AAD from the header; a caller AAD is not accepted
      kit.encrypt("payload", "serialised", { aad });

      // @ts-expect-error — the default mode is cbor, which derives its AAD from the header
      kit.encrypt("payload", { aad });

      expect(kit.decrypt(record, { aad })).toEqual("payload");
    });

    test("decrypt / verify / assert take only aad — apu and apv are encrypt-time", () => {
      const cipher = kit.encrypt("payload", "cbor", { apu, apv });

      // @ts-expect-error — apu is an encrypt-time parameter, carried on the header
      kit.decrypt(cipher, { apu });

      // @ts-expect-error — apv is an encrypt-time parameter, carried on the header
      kit.verify("payload", cipher, { apv });

      // @ts-expect-error — apu is an encrypt-time parameter, carried on the header
      kit.assert("payload", cipher, { apu });

      expect(kit.decrypt(cipher)).toEqual("payload");
    });
  });
});
