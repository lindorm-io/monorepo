import { removeEmptyFromObject } from "@lindorm-io/core";
import { AesEncryptionData } from "../../types";

export const encodeAesString = ({
  encryption: algorithm,
  authTag,
  content,
  encryptionKeyAlgorithm,
  format,
  initialisationVector,
  integrityHash,
  keyId,
  publicEncryptionJwk,
  publicEncryptionKey,
  version,
}: AesEncryptionData): string => {
  const values = removeEmptyFromObject({
    v: version,
    f: format,
    cek: publicEncryptionKey?.toString(format),
    crv: publicEncryptionJwk?.crv,
    eka: encryptionKeyAlgorithm,
    ih: integrityHash,
    iv: initialisationVector.toString(format),
    kid: publicEncryptionKey && keyId ? keyId.toString(format) : undefined,
    tag: authTag?.toString(format),
    x: publicEncryptionJwk?.x,
    y: publicEncryptionJwk?.y,
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = content.toString(format);

  return `\$${algorithm}\$${str}\$${cnt}\$`;
};
