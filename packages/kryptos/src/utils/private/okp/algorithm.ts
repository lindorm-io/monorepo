import { KryptosError } from "../../../errors";
import { GenerateOkpOptions, OkpSigAlgorithm } from "../../../types";

export const _getOkpSigAlgorithm = (options: GenerateOkpOptions): OkpSigAlgorithm => {
  switch (options.curve) {
    case "Ed25519":
    case "Ed448":
      return "EdDSA";

    case "X25519":
    case "X448":
      return "ECDH";

    default:
      throw new KryptosError("Unsupported curve");
  }
};
