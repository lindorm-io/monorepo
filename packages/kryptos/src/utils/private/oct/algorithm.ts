import { KryptosError } from "../../../errors";
import { GenerateOctOptions, OctSigAlgorithm } from "../../../types";

export const _getOctSigAlgorithm = (options: GenerateOctOptions): OctSigAlgorithm => {
  switch (options.size) {
    case 64:
      return "HS256";

    case 128:
      return "HS384";

    case 256:
      return "HS512";

    default:
      throw new KryptosError("Unsupported size");
  }
};
