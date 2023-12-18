import { randomBytes } from "crypto";
import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { AesCipherAlgorithm } from "../../types";

export const getInitialisationVector = (algorithm: AesCipherAlgorithm): Buffer => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC:
    case AesAlgorithm.AES_192_CBC:
    case AesAlgorithm.AES_256_CBC:
      return randomBytes(16);

    case AesAlgorithm.AES_128_CBC_HS256:
    case AesAlgorithm.AES_192_CBC_HS256:
    case AesAlgorithm.AES_256_CBC_HS256:
      return randomBytes(16);

    case AesAlgorithm.AES_128_GCM:
    case AesAlgorithm.AES_192_GCM:
    case AesAlgorithm.AES_256_GCM:
      return randomBytes(12);

    default:
      throw new AesError("Unexpected algorithm", {
        description: "Algorithm does not support initialisation vector",
        debug: { algorithm },
      });
  }
};
