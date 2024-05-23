import { removeEmpty } from "@lindorm/utils";
import { B64U } from "../../constants/private/format";
import { AesEncryptionData } from "../../types";
import { AesStringValues } from "../../types/private";

export const encodeAesString = ({
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
    kid: keyId.toString(B64U),

    // Required
    alg: algorithm,
    iv: initialisationVector.toString(B64U),
    tag: authTag.toString(B64U),

    // Key Derivation
    hks: hkdfSalt?.toString(B64U),
    p2c: pbkdfIterations?.toString(),
    p2s: pbkdfSalt?.toString(B64U),

    // Public Encryption Key
    pei: publicEncryptionIv?.toString(B64U),
    pek: publicEncryptionKey?.toString(B64U),
    pet: publicEncryptionTag?.toString(B64U),

    // Public JWK
    crv: publicEncryptionJwk?.crv,
    kty: publicEncryptionJwk?.kty,
    x: publicEncryptionJwk?.x,
    y: publicEncryptionJwk?.y,
  });
  const array = Object.entries(values).map(([key, value]) => `${key}=${value}`);

  const str = array.join(",");
  const cnt = content.toString(B64U);

  return `$${encryption}$${str}$${cnt}$`;
};
