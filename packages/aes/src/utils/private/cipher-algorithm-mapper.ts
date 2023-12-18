import { AesAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { AesCipherAlgorithm } from "../../types";

export const mapCipherAlgorithmToAesAlgorithm = (algorithm: string): AesAlgorithm => {
  switch (algorithm) {
    case "aes-128-cbc":
      return AesAlgorithm.AES_128_CBC;
    case "aes-192-cbc":
      return AesAlgorithm.AES_192_CBC;
    case "aes-256-cbc":
      return AesAlgorithm.AES_256_CBC;

    case "aes-128-cbc-hs256":
      return AesAlgorithm.AES_128_CBC_HS256;
    case "aes-192-cbc-hs256":
      return AesAlgorithm.AES_192_CBC_HS256;
    case "aes-256-cbc-hs256":
      return AesAlgorithm.AES_256_CBC_HS256;

    case "aes-128-gcm":
      return AesAlgorithm.AES_128_GCM;
    case "aes-192-gcm":
      return AesAlgorithm.AES_192_GCM;
    case "aes-256-gcm":
      return AesAlgorithm.AES_256_GCM;

    default:
      throw new AesError("Unexpected algorithm");
  }
};

export const mapAesAlgorithmToCryptoAlgorithm = (algorithm: AesCipherAlgorithm): string => {
  switch (algorithm) {
    case AesAlgorithm.AES_128_CBC:
      return "aes-128-cbc";
    case AesAlgorithm.AES_192_CBC:
      return "aes-192-cbc";
    case AesAlgorithm.AES_256_CBC:
      return "aes-256-cbc";

    case AesAlgorithm.AES_128_CBC_HS256:
      return "aes-128-cbc";
    case AesAlgorithm.AES_192_CBC_HS256:
      return "aes-192-cbc";
    case AesAlgorithm.AES_256_CBC_HS256:
      return "aes-256-cbc";

    case AesAlgorithm.AES_128_GCM:
      return "aes-128-gcm";
    case AesAlgorithm.AES_192_GCM:
      return "aes-192-gcm";
    case AesAlgorithm.AES_256_GCM:
      return "aes-256-gcm";

    default:
      throw new AesError("Unexpected algorithm");
  }
};
