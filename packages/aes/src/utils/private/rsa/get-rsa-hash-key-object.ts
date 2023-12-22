import { RsaPemValues } from "@lindorm-io/jwk";
import { RsaPrivateKey, constants } from "crypto";
import { AesEncryptionKeyAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";
import { mapEncryptionKeyAlgorithmToShaAlgorithm } from "../mappers/encryption-key-algorithm-mapper";

export const getRsaHashKeyObject = (
  pem: Omit<RsaPemValues, "type">,
  encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm,
): RsaPrivateKey => {
  if (pem.privateKey) {
    return {
      key: pem.privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: mapEncryptionKeyAlgorithmToShaAlgorithm(encryptionKeyAlgorithm),
      ...(pem.passphrase ? { passphrase: pem.passphrase } : {}),
    };
  }

  if (pem.publicKey) {
    return {
      key: pem.publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: mapEncryptionKeyAlgorithmToShaAlgorithm(encryptionKeyAlgorithm),
    };
  }

  throw new AesError("Unable to create RSA hash key object", { debug: { pem } });
};
