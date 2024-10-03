import {
  IKryptos,
  Kryptos,
  KryptosEncAlgorithm,
  KryptosEncryption,
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
      kryptos = Kryptos.auto({ algorithm });
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
});
