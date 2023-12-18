import { AesEncryptionKeyAlgorithm, ShaAlgorithm } from "../../enums";
import { AesError } from "../../errors";

export const mapEncryptionKeyAlgorithmToShaAlgorithm = (
  hash: AesEncryptionKeyAlgorithm,
): ShaAlgorithm => {
  switch (hash) {
    case AesEncryptionKeyAlgorithm.RSA_OAEP:
      return ShaAlgorithm.SHA1;

    case AesEncryptionKeyAlgorithm.RSA_OAEP_256:
      return ShaAlgorithm.SHA256;

    case AesEncryptionKeyAlgorithm.RSA_OAEP_384:
      return ShaAlgorithm.SHA384;

    case AesEncryptionKeyAlgorithm.RSA_OAEP_512:
      return ShaAlgorithm.SHA512;

    default:
      throw new AesError("Unexpected RSA OAEP hash", {
        debug: { hash },
      });
  }
};

export const mapStringToEncryptionKeyAlgorithm = (hash: string): AesEncryptionKeyAlgorithm => {
  switch (hash) {
    case "rsa-oaep":
      return AesEncryptionKeyAlgorithm.RSA_OAEP;

    case "rsa-oaep-256":
      return AesEncryptionKeyAlgorithm.RSA_OAEP_256;

    case "rsa-oaep-384":
      return AesEncryptionKeyAlgorithm.RSA_OAEP_384;

    case "rsa-oaep-512":
      return AesEncryptionKeyAlgorithm.RSA_OAEP_512;

    default:
      throw new AesError("Unexpected key hash", {
        debug: { hash },
      });
  }
};
