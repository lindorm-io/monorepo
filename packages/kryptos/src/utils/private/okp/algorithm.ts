import { KryptosError } from "../../../errors";
import { GenerateOkpOptions, OkpEncAlgorithm, OkpSigAlgorithm } from "../../../types";

export const _getOkpEncAlgorithm = (options: GenerateOkpOptions): OkpEncAlgorithm => {
  switch (options.curve) {
    case "X25519":
    case "X448":
      return "ECDH-ES";

    default:
      throw new KryptosError("Unsupported curve");
  }
};

export const _getOkpSigAlgorithm = (options: GenerateOkpOptions): OkpSigAlgorithm => {
  switch (options.curve) {
    case "Ed25519":
    case "Ed448":
      return "EdDSA";

    default:
      throw new KryptosError("Unsupported curve");
  }
};
