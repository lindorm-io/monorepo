import type { KryptosEncryption } from "@lindorm/kryptos";
import { AesError } from "../../../errors/index.js";
import { getAesDescriptor } from "../aes-descriptor.js";

type Result = {
  encryptionKey: Buffer;
  hashKey: Buffer;
};

export const splitContentEncryptionKey = (
  encryption: KryptosEncryption,
  contentEncryptionKey: Buffer,
): Result => {
  const { cipherKeyBytes, mode } = getAesDescriptor(encryption);

  if (mode === "cbc-hmac") {
    // RFC 7518 Section 5.2.2: MAC_KEY = initial octets, ENC_KEY = final octets.
    const hashKey = contentEncryptionKey.subarray(0, cipherKeyBytes);
    const encryptionKey = contentEncryptionKey.subarray(cipherKeyBytes);
    return { encryptionKey, hashKey };
  }

  // AEAD (GCM/CCM): encryptionKey = full CEK, hashKey = empty.
  const encryptionKey = contentEncryptionKey.subarray(0, cipherKeyBytes);
  const hashKey = contentEncryptionKey.subarray(cipherKeyBytes);

  if (hashKey.length) {
    throw new AesError("Unexpected hash key", {
      code: "unexpected_hash_key",
      title: "Unexpected Hash Key",
      details:
        "AEAD encryption (GCM/CCM) uses the full content encryption key for encryption and must not leave any leftover hash key octets.",
    });
  }

  return { encryptionKey, hashKey };
};
