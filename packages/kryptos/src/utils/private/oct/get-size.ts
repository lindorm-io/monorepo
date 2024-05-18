import { KryptosError } from "../../../errors";
import { GenerateOctOptions, OctSize } from "../../../types";

export const _getOctSize = (options: GenerateOctOptions): OctSize => {
  switch (options.algorithm) {
    case "A128KW":
    case "HS256":
      return 64;

    case "A192KW":
    case "HS384":
      return 96;

    case "A256KW":
    case "HS512":
    case "dir":
      return 128;

    default:
      throw new KryptosError("Unsupported size");
  }
};
