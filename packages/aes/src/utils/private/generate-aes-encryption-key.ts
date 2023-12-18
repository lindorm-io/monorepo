import { randomBytes } from "crypto";
import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { AesCipherAlgorithm } from "../../types";

export const generateAesEncryptionKey = (algorithm: AesCipherAlgorithm): Buffer => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC:
      return randomBytes(16);

    case AesAlgorithm.AES_192_CBC:
      return randomBytes(24);

    case AesAlgorithm.AES_256_CBC:
      return randomBytes(32);

    case AesAlgorithm.AES_128_GCM:
      return randomBytes(16);

    case AesAlgorithm.AES_192_GCM:
      return randomBytes(24);

    case AesAlgorithm.AES_256_GCM:
      return randomBytes(32);

    default:
      throw new AesError("Invalid AES cipher algorithm", {
        description: "Unknown algorithm",
        debug: { algorithm },
      });
  }
};
