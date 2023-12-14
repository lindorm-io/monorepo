import {
  AesAlgorithm,
  decodeAesString,
  decryptAesCipher,
  encodeAesString,
  encryptAesCipher,
} from "@lindorm-io/aes";
import { TokenError } from "../../error";
import { mapAlgorithmToJweEncoding, mapJweEncodingToAlgorithm } from "../private";

export type EncryptJweOptions = {
  algorithm?: AesAlgorithm;
  token: string;
  key: string;
};

export type DecryptJweOptions = {
  jwe: string;
  key: string;
};

const B64 = "base64";
const ALG = "RSA-OAEP";
const TYP = "JWE";

export const encryptJwe = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  token,
  key,
}: EncryptJweOptions) => {
  const encrypted = encryptAesCipher({
    algorithm,
    data: token,
    key,
  });

  const { authTag, encryption, initialisationVector, publicEncryptionKey } =
    decodeAesString(encrypted);

  if (!publicEncryptionKey) {
    throw new TokenError("Failed to create JWE: missing public encryption key.");
  }

  const enc = mapAlgorithmToJweEncoding(algorithm);

  const jweComponents = [
    Buffer.from(JSON.stringify({ alg: ALG, enc, typ: TYP, ver: 1 })).toString(B64),
    publicEncryptionKey.toString(B64),
    initialisationVector.toString(B64),
    encryption.toString(B64),
    authTag.toString(B64),
  ];

  return jweComponents.join(".");
};

export const decryptJwe = ({ jwe, key }: DecryptJweOptions) => {
  const [header, publicEncryptionKey, initialisationVector, encryption, authTag] = jwe.split(".");
  const { alg, enc, typ, ver } = JSON.parse(Buffer.from(header, B64).toString());

  if (typ !== TYP) {
    throw new TokenError("Failed to decrypt JWE: unsupported type.");
  }

  if (alg !== ALG) {
    throw new TokenError("Failed to decrypt JWE: unsupported algorithm.");
  }

  const algorithm = mapJweEncodingToAlgorithm(enc);

  const cipher = encodeAesString({
    algorithm,
    authTag: Buffer.from(authTag, B64),
    encryption: Buffer.from(encryption, B64),
    format: B64,
    initialisationVector: Buffer.from(initialisationVector, B64),
    publicEncryptionKey: Buffer.from(publicEncryptionKey, B64),
    version: ver ? parseInt(ver, 10) : 1,
  });

  return decryptAesCipher({ cipher, key });
};
