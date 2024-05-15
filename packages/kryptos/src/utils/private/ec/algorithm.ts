import { KryptosError } from "../../../errors";
import { EcSigAlgorithm, GenerateEcOptions } from "../../../types";

export const _getEcSigAlgorithm = (options: GenerateEcOptions): EcSigAlgorithm => {
  switch (options.curve) {
    case "P-256":
      return "ES256";

    case "P-384":
      return "ES384";

    case "P-521":
      return "ES512";

    default:
      throw new KryptosError("Unsupported curve");
  }
};
