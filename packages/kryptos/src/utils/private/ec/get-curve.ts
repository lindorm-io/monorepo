import { KryptosError } from "../../../errors";
import { EcCurve, EcGenerate } from "../../../types";

export const _getEcCurve = (options: EcGenerate): EcCurve => {
  if (options.curve) return options.curve;

  switch (options.algorithm) {
    case "ES256":
    case "ECDH-ES":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A128GCMKW":
      return "P-256";

    case "ES384":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A192GCMKW":
      return "P-384";

    case "ES512":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A256GCMKW":
      return "P-521";

    default:
      throw new KryptosError("Unsupported curve");
  }
};
