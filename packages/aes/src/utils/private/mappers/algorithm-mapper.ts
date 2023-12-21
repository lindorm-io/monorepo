import { AesAlgorithm } from "../../../enums";
import { AesError } from "../../../errors";

export const mapStringToAesAlgorithm = (algorithm: string): AesAlgorithm => {
  switch (algorithm) {
    case "aes-128-cbc":
      return AesAlgorithm.AES_128_CBC;
    case "aes-192-cbc":
      return AesAlgorithm.AES_192_CBC;
    case "aes-256-cbc":
      return AesAlgorithm.AES_256_CBC;

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
