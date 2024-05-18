import { KryptosError } from "../../../errors";
import { EcCurve, GenerateEcOptions } from "../../../types";

export const _getEcCurve = (options: GenerateEcOptions): EcCurve => {
  if (options.curve) return options.curve;

  switch (options.algorithm) {
    case "ES256":
    case "ECDH-ES":
    case "ECDH-ES+A128KW":
      return "P-256";

    case "ES384":
    case "ECDH-ES+A192KW":
      return "P-384";

    case "ES512":
    case "ECDH-ES+A256KW":
      return "P-521";

    default:
      throw new KryptosError("Unsupported curve");
  }
};
