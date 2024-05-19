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

export const _splitContentEncryptionKey = (
  encryption: KryptosEncryption,
  contentEncryptionKey: Buffer,
): Result => {
  const keyLength = encryptionKeyLength(encryption);

  const encryptionKey = contentEncryptionKey.subarray(0, keyLength);
  const hashKey = contentEncryptionKey.subarray(keyLength);

  if (
    hashKey.length &&
    (encryption === "A128GCM" || encryption === "A192GCM" || encryption === "A256GCM")
  ) {
    throw new AesError("Unexpected hash key");
  }

  return { encryptionKey, hashKey };
};
