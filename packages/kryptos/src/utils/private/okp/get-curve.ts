import { KryptosError } from "../../../errors";
import { KryptosAlgorithm, KryptosCurve, OkpAlgorithm, OkpCurve } from "../../../types";
import { isOkpCurve } from "./is-okp-curve";

type Options = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
};

export const getOkpCurve = (options: Options): OkpCurve => {
  if (isOkpCurve(options.curve)) return options.curve;

  switch (options.algorithm as OkpAlgorithm) {
    case "ECDH-ES":
    case "ECDH-ES+A128KW":
    case "ECDH-ES+A128GCMKW":
      return "X25519";

    case "ECDH-ES+A192KW":
    case "ECDH-ES+A192GCMKW":
      return "X448";

    case "ECDH-ES+A256KW":
    case "ECDH-ES+A256GCMKW":
      return "X448";

    case "EdDSA":
      return "Ed448";

    default:
      throw new KryptosError("Unsupported curve");
  }
};
