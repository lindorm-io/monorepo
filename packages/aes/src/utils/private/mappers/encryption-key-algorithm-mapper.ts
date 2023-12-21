import { AesEncryptionKeyAlgorithm, ShaAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";

export const mapEncryptionKeyAlgorithmToShaAlgorithm = (
  algorithm: AesEncryptionKeyAlgorithm,
): ShaAlgorithm => {
  switch (algorithm) {
    case AesEncryptionKeyAlgorithm.RSA_OAEP:
      return ShaAlgorithm.SHA1;

    case AesEncryptionKeyAlgorithm.RSA_OAEP_256:
      return ShaAlgorithm.SHA256;

    case AesEncryptionKeyAlgorithm.RSA_OAEP_384:
      return ShaAlgorithm.SHA384;

    case AesEncryptionKeyAlgorithm.RSA_OAEP_512:
      return ShaAlgorithm.SHA512;

    default:
      throw new AesError("Unexpected encryption key algorithm", {
        debug: { algorithm },
      });
  }
};

export const mapStringToEncryptionKeyAlgorithm = (algorithm: string): AesEncryptionKeyAlgorithm => {
  switch (algorithm) {
    case "rsa-oaep":
      return AesEncryptionKeyAlgorithm.RSA_OAEP;

    case "rsa-oaep-256":
      return AesEncryptionKeyAlgorithm.RSA_OAEP_256;

    case "rsa-oaep-384":
      return AesEncryptionKeyAlgorithm.RSA_OAEP_384;

    case "rsa-oaep-512":
      return AesEncryptionKeyAlgorithm.RSA_OAEP_512;

    default:
      throw new AesError("Unexpected encryption key algorithm", {
        debug: { algorithm },
      });
  }
};
