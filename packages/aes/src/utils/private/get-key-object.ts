import { RsaPrivateKey, constants } from "crypto";
import { AesEncryptionKeyAlgorithm } from "../../enums";
import { AesCipherKey } from "../../types";
import { mapEncryptionKeyAlgorithmToShaAlgorithm } from "./encryption-key-algorithm-mapper";

export const getKeyObject = (
  key: AesCipherKey,
  oaepHash: AesEncryptionKeyAlgorithm,
): RsaPrivateKey => ({
  ...(typeof key === "string" ? { key } : key),
  padding: constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: mapEncryptionKeyAlgorithmToShaAlgorithm(oaepHash),
});
