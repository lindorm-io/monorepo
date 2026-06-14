import { AES_ENCRYPTION_ALGORITHMS } from "@lindorm/types";
import { describe, expect, test } from "vitest";
import type { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../errors/index.js";
import { getAesDescriptor } from "./aes-descriptor.js";
import { calculateContentEncryptionKeySize } from "./calculate/calculate-content-encryption-key-size.js";

describe("getAesDescriptor", () => {
  test("resolves a descriptor for every supported AES encryption", () => {
    for (const encryption of AES_ENCRYPTION_ALGORITHMS) {
      expect(() => getAesDescriptor(encryption)).not.toThrow();
    }
  });

  test("descriptor cekBytes matches calculateContentEncryptionKeySize", () => {
    for (const encryption of AES_ENCRYPTION_ALGORITHMS) {
      expect(getAesDescriptor(encryption).cekBytes).toBe(
        calculateContentEncryptionKeySize(encryption),
      );
    }
  });

  test("throws AesError for an unsupported encryption", () => {
    expect(() => getAesDescriptor("NOPE" as KryptosEncryption)).toThrow(AesError);
  });

  test.each([
    // encryption, nodeCipher, cipherKeyBytes, cekBytes, ivBytes, tagBytes, mode
    ["A128GCM", "aes-128-gcm", 16, 16, 12, 16, "gcm"],
    ["A256GCM", "aes-256-gcm", 32, 32, 12, 16, "gcm"],
    ["A128CBC-HS256", "aes-128-cbc", 16, 32, 16, 16, "cbc-hmac"],
    ["A256CBC-HS512", "aes-256-cbc", 32, 64, 16, 32, "cbc-hmac"],
    // CCM: name AES-CCM-{L}-{tagBits}-{keyBits}; L 16->iv13, 64->iv7; tag/8; key/8
    ["AES-CCM-16-64-128", "aes-128-ccm", 16, 16, 13, 8, "ccm"],
    ["AES-CCM-64-64-128", "aes-128-ccm", 16, 16, 7, 8, "ccm"],
    ["AES-CCM-16-128-256", "aes-256-ccm", 32, 32, 13, 16, "ccm"],
    ["AES-CCM-64-128-256", "aes-256-ccm", 32, 32, 7, 16, "ccm"],
  ])(
    "%s → %s",
    (encryption, nodeCipher, cipherKeyBytes, cekBytes, ivBytes, tagBytes, mode) => {
      const d = getAesDescriptor(encryption as KryptosEncryption);

      expect(d.nodeCipher).toBe(nodeCipher);
      expect(d.cipherKeyBytes).toBe(cipherKeyBytes);
      expect(d.cekBytes).toBe(cekBytes);
      expect(d.ivBytes).toBe(ivBytes);
      expect(d.tagBytes).toBe(tagBytes);
      expect(d.mode).toBe(mode);
      expect(d.aead).toBe(mode !== "cbc-hmac");
    },
  );
});
