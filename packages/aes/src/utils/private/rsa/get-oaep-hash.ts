import { AesError } from "../../../errors";
import { EncryptionKeyAlgorithm, ShaHash } from "../../../types";

export const _getOaepHash = (encryption: EncryptionKeyAlgorithm): ShaHash => {
  switch (encryption) {
    case "RSA-OAEP":
      return "sha1";

    case "RSA-OAEP-256":
      return "sha256";

    case "RSA-OAEP-384":
      return "sha384";

    case "RSA-OAEP-512":
      return "sha512";

    default:
      throw new AesError("Unexpected encryption key algorithm", {
        debug: { encryption },
      });
  }
};
