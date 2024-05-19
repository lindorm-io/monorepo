import { removeEmpty } from "@lindorm/utils";
import { AesEncryptionData } from "../../types";
import { AesStringValues } from "../../types/private";

export const _encodeAesString = ({
  algorithm,
  authTag,
  content,
  encryption,
  format,
  hkdfSalt,
  initialisationVector,
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

    // Required
    alg: algorithm,
    iv: initialisationVector.toString(format),
    kid: keyId.toString(format),
    tag: authTag.toString(format),

    // Optional
    hks: hkdfSalt?.toString(format),
    p2c: pbkdfIterations?.toString(),
    p2s: pbkdfSalt?.toString(format),
    pek: publicEncryptionKey?.toString(format),

    // Public JWK
    crv: publicEncryptionJwk?.crv,
    kty: publicEncryptionJwk?.kty,
    x: publicEncryptionJwk?.x,
    y: publicEncryptionJwk?.y,
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = content.toString(format);

  return `$${encryption}$${str}$${cnt}$`;
};
