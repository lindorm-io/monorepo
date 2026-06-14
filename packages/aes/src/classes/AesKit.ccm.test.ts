import { KryptosKit } from "@lindorm/kryptos";
import { CCM_ENCRYPTION_ALGORITHMS } from "@lindorm/types";
import type { AesCcmEncryption } from "@lindorm/types";
import { beforeEach, describe, expect, test } from "vitest";
import { AesError } from "../errors/index.js";
import { getAesDescriptor } from "../internal/utils/aes-descriptor.js";
import { AesKit } from "./AesKit.js";

const dirKit = (encryption: AesCcmEncryption): AesKit =>
  new AesKit({
    encryption,
    kryptos: KryptosKit.generate.enc.oct({ algorithm: "dir", encryption }),
  });

describe("AesKit — AES-CCM", () => {
  describe.each(CCM_ENCRYPTION_ALGORITHMS)("%s", (encryption) => {
    let kit: AesKit;

    beforeEach(() => {
      kit = dirKit(encryption);
    });

    test("round-trips through the encoded wire format", () => {
      expect(kit.decrypt(kit.encrypt("the quick brown fox", "encoded"))).toBe(
        "the quick brown fox",
      );
    });

    test("round-trips through the serialised wire format", () => {
      expect(kit.decrypt(kit.encrypt("the quick brown fox", "serialised"))).toBe(
        "the quick brown fox",
      );
    });

    test("round-trips through the tokenised wire format", () => {
      expect(kit.decrypt(kit.encrypt("the quick brown fox", "tokenised"))).toBe(
        "the quick brown fox",
      );
    });

    test("round-trips through the record format", () => {
      const record = kit.encrypt("payload", "record");

      expect(kit.decrypt(record)).toBe("payload");
      // record carries the algorithm-correct nonce + tag lengths
      const d = getAesDescriptor(encryption);
      expect(record.initialisationVector.length).toBe(d.ivBytes);
      expect(record.authTag.length).toBe(d.tagBytes);
    });

    test("rejects a tampered ciphertext", () => {
      const record = kit.encrypt("secret", "record");
      record.content[0] ^= 0xff;

      expect(() => kit.decrypt(record)).toThrow(AesError);
    });
  });

  describe("encryptContent / decryptContent primitive", () => {
    test("round-trips opaque bytes with a caller-supplied AAD", () => {
      const kit = dirKit("AES-CCM-16-128-128");
      const aad = Buffer.from("cose-enc-structure");
      const plaintext = Buffer.from([0x01, 0x02, 0x03, 0x04]);

      const { ciphertext, iv, tag } = kit.encryptContent(plaintext, { aad });
      const decrypted = kit.decryptContent({ aad, ciphertext, iv, tag });

      expect(decrypted).toEqual(plaintext);
    });

    test("is byte-stable for a fixed key + iv + aad (COSE deterministic nonce)", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "AES-CCM-16-128-256",
      });
      const kit = new AesKit({ kryptos, encryption: "AES-CCM-16-128-256" });
      const aad = Buffer.from("aad");
      const iv = Buffer.alloc(13, 7);
      const plaintext = Buffer.from("deterministic");

      const a = kit.encryptContent(plaintext, { aad, iv });
      const b = kit.encryptContent(plaintext, { aad, iv });

      expect(a.ciphertext.equals(b.ciphertext)).toBe(true);
      expect(a.tag.equals(b.tag)).toBe(true);
      expect(a.iv.equals(iv)).toBe(true);
    });

    test("fails to decrypt when the AAD differs", () => {
      const kit = dirKit("AES-CCM-64-64-128");
      const { ciphertext, iv, tag } = kit.encryptContent(Buffer.from("x"), {
        aad: Buffer.from("right"),
      });

      expect(() =>
        kit.decryptContent({ aad: Buffer.from("wrong"), ciphertext, iv, tag }),
      ).toThrow(AesError);
    });

    test("rejects a non-direct (key-wrapping) kryptos", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A256KW" });
      const kit = new AesKit({ kryptos, encryption: "A256GCM" });

      expect(() => kit.encryptContent(Buffer.from("x"))).toThrow(AesError);
    });
  });
});
