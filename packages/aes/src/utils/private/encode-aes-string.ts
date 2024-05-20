import { removeEmpty } from "@lindorm/utils";
import { _B64U } from "../../constants/private/format";
import { AesEncryptionData } from "../../types";
import { AesStringValues } from "../../types/private";

export const _encodeAesString = ({
  algorithm,
  authTag,
  content,
  encryption,
  hkdfSalt,
  initialisationVector,
  keyId,
  pbkdfIterations,
  pbkdfSalt,
  publicEncryptionIv,
  publicEncryptionJwk,
  publicEncryptionKey,
  publicEncryptionTag,
  version,
}: AesEncryptionData): string => {
  const values: AesStringValues = removeEmpty({
    v: version.toString(),
    kid: keyId.toString(_B64U),

    // Required
    alg: algorithm,
    iv: initialisationVector.toString(_B64U),
    tag: authTag.toString(_B64U),

    // Key Derivation
    hks: hkdfSalt?.toString(_B64U),
    p2c: pbkdfIterations?.toString(),
    p2s: pbkdfSalt?.toString(_B64U),

    // Public Encryption Key
    pei: publicEncryptionIv?.toString(_B64U),
    pek: publicEncryptionKey?.toString(_B64U),
    pet: publicEncryptionTag?.toString(_B64U),

    // Public JWK
    crv: publicEncryptionJwk?.crv,
    kty: publicEncryptionJwk?.kty,
    x: publicEncryptionJwk?.x,
    y: publicEncryptionJwk?.y,
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = content.toString(_B64U);

  return `$${encryption}$${str}$${cnt}$`;
};
