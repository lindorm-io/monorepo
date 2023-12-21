import { removeEmptyFromObject } from "@lindorm-io/core";
import { AesEncryptionData } from "../../types";

export const encodeAesString = ({
  algorithm,
  authTag,
  content,
  format,
  initialisationVector,
  encryptionKeyAlgorithm,
  keyId,
  publicEncryptionKey,
  version,
}: AesEncryptionData): string => {
  const values = removeEmptyFromObject({
    v: version,
    f: format,
    cek: publicEncryptionKey?.toString(format),
    eka: encryptionKeyAlgorithm?.toLowerCase(),
    iv: initialisationVector.toString(format),
    kid: publicEncryptionKey && keyId ? keyId.toString(format) : undefined,
    tag: authTag?.toString(format),
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = content.toString(format);

  return `\$${algorithm}\$${str}\$${cnt}\$`;
};
