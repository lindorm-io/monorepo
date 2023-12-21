import { AesAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";

export const calculateSecretLength = (algorithm: AesAlgorithm): number => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC:
    case AesAlgorithm.AES_128_GCM:
      return 16;

    case AesAlgorithm.AES_192_CBC:
    case AesAlgorithm.AES_192_GCM:
      return 24;

    case AesAlgorithm.AES_256_CBC:
    case AesAlgorithm.AES_256_GCM:
      return 32;

    default:
      throw new AesError(`Unsupported algorithm: ${algorithm}`);
  }
};
