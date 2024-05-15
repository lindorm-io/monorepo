import { KryptosError } from "../../../errors";
import { GenerateRsaOptions, RsaEncAlgorithm, RsaSigAlgorithm } from "../../../types";

export const _getRsaEncAlgorithm = (options: GenerateRsaOptions): RsaEncAlgorithm => {
  switch (options.size) {
    case 1:
      return "RSA-OAEP";

    case 2:
      return "RSA-OAEP-256";

    case 3:
      return "RSA-OAEP-384";

    case 4:
      return "RSA-OAEP-512";

    default:
      throw new KryptosError("Unsupported size");
  }
};

export const _getRsaSigAlgorithm = (options: GenerateRsaOptions): RsaSigAlgorithm => {
  switch (options.size) {
    case 1:
      return "RS256";

    case 2:
      return "RS256";

    case 3:
      return "RS384";

    case 4:
      return "RS512";

    default:
      throw new KryptosError("Unsupported size");
  }
};
