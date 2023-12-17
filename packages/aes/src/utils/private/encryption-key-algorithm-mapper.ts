import { AesEncryptionKeyAlgorithm, ShaAlgorithm } from "../../enums";
import { AesError } from "../../errors";

export const mapEncryptionKeyAlgorithmToShaAlgorithm = (
  hash: AesEncryptionKeyAlgorithm,
): ShaAlgorithm => {
  switch (hash) {
    case AesEncryptionKeyAlgorithm.SHA1:
      return ShaAlgorithm.SHA1;

    case AesEncryptionKeyAlgorithm.SHA256:
      return ShaAlgorithm.SHA256;

    case AesEncryptionKeyAlgorithm.SHA384:
      return ShaAlgorithm.SHA384;

    case AesEncryptionKeyAlgorithm.SHA512:
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
      return AesEncryptionKeyAlgorithm.SHA1;

    case "rsa-oaep-256":
      return AesEncryptionKeyAlgorithm.SHA256;

    case "rsa-oaep-384":
      return AesEncryptionKeyAlgorithm.SHA384;

    case "rsa-oaep-512":
      return AesEncryptionKeyAlgorithm.SHA512;

    default:
      throw new AesError("Unexpected key hash", {
        debug: { hash },
      });
  }
};
