import { KryptosError } from "../../../errors";
import { GenerateRsaOptions, RsaModulus } from "../../../types";

export const _getRsaModulus = (options: GenerateRsaOptions): RsaModulus => {
  switch (options.algorithm) {
    case "RSA-OAEP":
      return 1024;

    case "PS256":
    case "RS256":
    case "RSA-OAEP-256":
      return 2048;

    case "PS384":
    case "RS384":
    case "RSA-OAEP-384":
      return 3072;

    case "PS512":
    case "RS512":
    case "RSA-OAEP-512":
      return 4096;

    default:
      throw new KryptosError("Unsupported algorithm");
  }
};
