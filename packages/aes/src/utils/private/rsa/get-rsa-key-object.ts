import { RsaPrivateKey, constants } from "crypto";
import { AesEncryptionKeyAlgorithm } from "../../../enums";
import { AesKeyObject } from "../../../types";
import { mapEncryptionKeyAlgorithmToShaAlgorithm } from "../mappers/encryption-key-algorithm-mapper";

export const getRsaKeyObject = (
  key: AesKeyObject,
  encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm,
): RsaPrivateKey => ({
  key: key.key,
  padding: constants.RSA_PKCS1_OAEP_PADDING,
  oaepHash: mapEncryptionKeyAlgorithmToShaAlgorithm(encryptionKeyAlgorithm),
  ...(key.passphrase !== undefined ? { passphrase: key.passphrase } : {}),
});
