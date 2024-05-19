import { removeEmpty } from "@lindorm/utils";
import { AesEncryptionData } from "../../types";
import { AesStringValues } from "../../types/private";

export const _encodeAesString = ({
  authTag,
  content,
  encryption,
  encryptionKeyAlgorithm,
  format,
  hkdfSalt,
  initialisationVector,
  integrityHash,
  keyId,
  pbkdfIterations,
  pbkdfSalt,
  publicEncryptionJwk,
  publicEncryptionKey,
  version,
}: AesEncryptionData): string => {
  const values: AesStringValues = removeEmpty({
    v: version.toString(),
    f: format,
    crv: publicEncryptionJwk?.crv,
    eka: encryptionKeyAlgorithm,
    hks: hkdfSalt?.toString(format),
    ih: integrityHash,
    iv: initialisationVector.toString(format),
    kid: publicEncryptionKey && keyId ? keyId.toString(format) : undefined,
    kty: publicEncryptionJwk?.kty,
    p2c: pbkdfIterations?.toString(),
    p2s: pbkdfSalt?.toString(format),
    pek: publicEncryptionKey?.toString(format),
    tag: authTag?.toString(format),
    x: publicEncryptionJwk?.x,
    y: publicEncryptionJwk?.y,
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = content.toString(format);

  return `$${encryption}$${str}$${cnt}$`;
};
