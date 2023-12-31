import { decryptAesData, encryptAesData } from "@lindorm-io/aes";
import { removeUndefinedFromArray, removeUndefinedFromObject } from "@lindorm-io/core";
import { TokenError } from "../../error";
import { DecryptJweOptions, EncryptJweOptions } from "../../types";
import { mapEncryptionToJweEncoding, mapJweEncodingToEncryption } from "../private";

const B64 = "base64url";
const TYP = "JWE";

export const encryptJwe = ({
  encryption = "aes-256-gcm",
  encryptionKeyAlgorithm = "RSA-OAEP-256",
  key,
  keySet,
  token,
}: EncryptJweOptions) => {
  const {
    authTag,
    content,
    initialisationVector,
    keyId,
    publicEncryptionJwk,
    publicEncryptionKey,
  } = encryptAesData({
    data: token,
    encryption,
    encryptionKeyAlgorithm,
    integrityHash: encryption.includes("cbc") ? "sha256" : undefined,
    key,
    keySet,
  });

  if (!publicEncryptionJwk && !publicEncryptionKey) {
    throw new TokenError("Failed to create JWE: missing public encryption key.");
  }

  const header = removeUndefinedFromObject({
    alg: encryptionKeyAlgorithm,
    enc: mapEncryptionToJweEncoding(encryption),
    ...(publicEncryptionJwk ? { epk: publicEncryptionJwk } : {}),
    kid: keyId,
    typ: TYP,
  });

  const components = removeUndefinedFromArray([
    Buffer.from(JSON.stringify(header)).toString(B64),
    publicEncryptionKey ? publicEncryptionKey.toString(B64) : "",
    initialisationVector.toString(B64),
    content.toString(B64),
    authTag?.toString(B64),
  ]);

  return components.join(".");
};

export const decryptJwe = ({ jwe, key, keySet }: DecryptJweOptions) => {
  const [header, publicEncryptionKey, initialisationVector, content, authTag] = jwe.split(".");
  const {
    alg: encryptionKeyAlgorithm,
    enc,
    epk,
    typ,
  } = JSON.parse(Buffer.from(header, B64).toString());

  if (typ !== TYP) {
    throw new TokenError("Failed to decrypt JWE: unsupported type.", {
      debug: { expect: TYP, actual: typ },
    });
  }

  return decryptAesData({
    authTag: authTag ? Buffer.from(authTag, B64) : undefined,
    content: Buffer.from(content, B64),
    encryption: mapJweEncodingToEncryption(enc),
    encryptionKeyAlgorithm,
    initialisationVector: Buffer.from(initialisationVector, B64),
    key,
    keySet,
    publicEncryptionJwk: epk,
    publicEncryptionKey: publicEncryptionKey?.length
      ? Buffer.from(publicEncryptionKey, B64)
      : undefined,
  });
};
