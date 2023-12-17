import { AesAlgorithm, RsaOaepHash, decryptAesData, encryptAesData } from "@lindorm-io/aes";
import { TokenError } from "../../error";
import { mapAlgorithmToJweEncoding, mapJweEncodingToAlgorithm } from "../private";

export type EncryptJweOptions = {
  algorithm?: AesAlgorithm;
  key: string;
  oaepHash?: RsaOaepHash;
  token: string;
};

export type DecryptJweOptions = {
  jwe: string;
  key: string;
};

const B64 = "base64";
const TYP = "JWE";

export const encryptJwe = ({
  algorithm = AesAlgorithm.AES_256_GCM,
  key,
  oaepHash = RsaOaepHash.SHA1,
  token,
}: EncryptJweOptions) => {
  const { authTag, encryption, initialisationVector, publicEncryptionKey } = encryptAesData({
    algorithm,
    data: token,
    key,
    keyHash: oaepHash,
  });

  if (!publicEncryptionKey) {
    throw new TokenError("Failed to create JWE: missing public encryption key.");
  }

  const alg = oaepHash;
  const enc = mapAlgorithmToJweEncoding(algorithm);

  const components = [
    Buffer.from(JSON.stringify({ alg, enc, typ: TYP })).toString(B64),
    publicEncryptionKey.toString(B64),
    initialisationVector.toString(B64),
    encryption.toString(B64),
    authTag.toString(B64),
  ];

  return components.join(".");
};

export const decryptJwe = ({ jwe, key }: DecryptJweOptions) => {
  const [header, publicEncryptionKey, initialisationVector, encryption, authTag] = jwe.split(".");
  const { alg: keyHash, enc, typ } = JSON.parse(Buffer.from(header, B64).toString());

  if (typ !== TYP) {
    throw new TokenError("Failed to decrypt JWE: unsupported type.", {
      debug: { expect: TYP, actual: typ },
    });
  }

  const algorithm = mapJweEncodingToAlgorithm(enc);

  return decryptAesData({
    algorithm,
    authTag: Buffer.from(authTag, B64),
    encryption: Buffer.from(encryption, B64),
    initialisationVector: Buffer.from(initialisationVector, B64),
    key,
    keyHash,
    publicEncryptionKey: Buffer.from(publicEncryptionKey, B64),
  });
};
