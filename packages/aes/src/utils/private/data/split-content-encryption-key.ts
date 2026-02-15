import { KryptosEncryption } from "@lindorm/kryptos";
import { AesKeyLength } from "@lindorm/types";
import { AesError } from "../../../errors";

type Result = {
  encryptionKey: Buffer;
  hashKey: Buffer;
};

const encryptionKeyLength = (encryption: KryptosEncryption): AesKeyLength => {
  switch (encryption) {
    case "A128CBC-HS256":
    case "A128GCM":
      return 16;

    case "A192CBC-HS384":
    case "A192GCM":
      return 24;

    case "A256CBC-HS512":
    case "A256GCM":
      return 32;

    default:
      throw new AesError("Unexpected algorithm");
  }
};

export const splitContentEncryptionKey = (
  encryption: KryptosEncryption,
  contentEncryptionKey: Buffer,
): Result => {
  const keyLength = encryptionKeyLength(encryption);

  if (encryption.includes("CBC")) {
    // RFC 7518 Section 5.2.2: MAC_KEY = initial octets, ENC_KEY = final octets
    const hashKey = contentEncryptionKey.subarray(0, keyLength);
    const encryptionKey = contentEncryptionKey.subarray(keyLength);
    return { encryptionKey, hashKey };
  }

  // GCM: encryptionKey = full CEK, hashKey = empty
  const encryptionKey = contentEncryptionKey.subarray(0, keyLength);
  const hashKey = contentEncryptionKey.subarray(keyLength);

  if (hashKey.length) {
    throw new AesError("Unexpected hash key");
  }

  return { encryptionKey, hashKey };
};
