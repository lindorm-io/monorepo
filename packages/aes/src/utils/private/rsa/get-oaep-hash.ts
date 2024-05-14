import { ShaAlgorithm } from "@lindorm/types";
import { AesError } from "../../../errors";
import { AesEncryptionKeyAlgorithm } from "../../../types";

export const _getOaepHash = (encryption: AesEncryptionKeyAlgorithm): ShaAlgorithm => {
  switch (encryption) {
    case "RSA-OAEP":
      return "SHA1";

    case "RSA-OAEP-256":
      return "SHA256";

    case "RSA-OAEP-384":
      return "SHA384";

    case "RSA-OAEP-512":
      return "SHA512";

    default:
      throw new AesError("Unexpected encryption key algorithm", {
        debug: { encryption },
      });
  }
};
