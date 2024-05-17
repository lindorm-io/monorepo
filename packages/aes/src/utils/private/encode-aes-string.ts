import { removeEmpty } from "@lindorm/utils";
import { AesEncryptionData, AesStringValues } from "../../types";

export const _encodeAesString = ({
  authTag,
  content,
  encryption,
  encryptionKeyAlgorithm,
  format,
  initialisationVector,
  integrityHash,
  keyId,
  publicEncryptionJwk,
  publicEncryptionKey,
  salt,
  version,
}: AesEncryptionData): string => {
  const values: AesStringValues = removeEmpty({
    v: version.toString(),
    f: format,
    cek: publicEncryptionKey?.toString(format),
    crv: publicEncryptionJwk?.crv,
    eka: encryptionKeyAlgorithm,
    ih: integrityHash,
    iv: initialisationVector.toString(format),
    kid: publicEncryptionKey && keyId ? keyId.toString(format) : undefined,
    kty: publicEncryptionJwk?.kty,
    s: salt?.toString(format),
    tag: authTag?.toString(format),
    x: publicEncryptionJwk?.x,
    y: publicEncryptionJwk?.y,
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = content.toString(format);

  return `$${encryption}$${str}$${cnt}$`;
};
