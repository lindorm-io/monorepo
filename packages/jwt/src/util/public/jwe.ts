import {
  AesAlgorithm,
  AesEncryptionKeyAlgorithm,
  decryptAesData,
  encryptAesData,
} from "@lindorm-io/aes";
import { removeUndefinedFromArray, removeUndefinedFromObject } from "@lindorm-io/core";
import { TokenError } from "../../error";
import { DecryptJweOptions, EncryptJweOptions } from "../../types";
import { mapAesAlgorithmToJweEncoding, mapJweEncodingToAesAlgorithm } from "../private";

const B64 = "base64url";
const TYP = "JWE";

export const encryptJwe = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  key,
  keyId,
  encryptionKeyAlgorithm = AesEncryptionKeyAlgorithm.RSA_OAEP,
  token,
}: EncryptJweOptions) => {
  const { authTag, content, initialisationVector, publicEncryptionKey } = encryptAesData({
    algorithm,
    data: token,
    encryptionKeyAlgorithm,
    key,
  });

  if (!publicEncryptionKey) {
    throw new TokenError("Failed to create JWE: missing public encryption key.");
  }

  const header = removeUndefinedFromObject({
    alg: encryptionKeyAlgorithm,
    enc: mapAesAlgorithmToJweEncoding(algorithm),
    kid: keyId,
    typ: TYP,
  });

  const components = removeUndefinedFromArray([
    Buffer.from(JSON.stringify(header)).toString(B64),
    publicEncryptionKey.toString(B64),
    initialisationVector.toString(B64),
    content.toString(B64),
    authTag?.toString(B64),
  ]);

  return components.join(".");
};

export const decryptJwe = ({ jwe, key }: DecryptJweOptions) => {
  const [header, publicEncryptionKey, initialisationVector, content, authTag] = jwe.split(".");
  const { alg: encryptionKeyAlgorithm, enc, typ } = JSON.parse(Buffer.from(header, B64).toString());

  if (typ !== TYP) {
    throw new TokenError("Failed to decrypt JWE: unsupported type.", {
      debug: { expect: TYP, actual: typ },
    });
  }

  const algorithm = mapJweEncodingToAesAlgorithm(enc);

  return decryptAesData({
    algorithm,
    authTag: authTag ? Buffer.from(authTag, B64) : undefined,
    content: Buffer.from(content, B64),
    encryptionKeyAlgorithm,
    initialisationVector: Buffer.from(initialisationVector, B64),
    key,
    publicEncryptionKey: Buffer.from(publicEncryptionKey, B64),
  });
};
