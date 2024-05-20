import { KryptosError } from "../../../errors";
import { OctGenerate, OctSize } from "../../../types";

export const _getOctSize = (options: OctGenerate): OctSize => {
  if (options.algorithm === "dir") {
    switch (options.encryption) {
      case "A128GCM":
        return 16;

      case "A192GCM":
        return 24;

      case "A256GCM":
        return 32;

      case "A128CBC-HS256":
        return 48;

      case "A192CBC-HS384":
        return 72;

      case "A256CBC-HS512":
        return 96;

      default:
        throw new KryptosError("Unsupported size");
    }
  }

  switch (options.algorithm) {
    case "A128KW":
    case "A128GCMKW":
    case "PBES2-HS256+A128KW":
      return 16;

    case "A192KW":
    case "A192GCMKW":
    case "PBES2-HS384+A192KW":
      return 24;

    case "A256KW":
    case "A256GCMKW":
    case "PBES2-HS512+A256KW":
      return 32;

    case "HS256":
      return 64;

    case "HS384":
      return 96;

    case "HS512":
      return 128;

    default:
      throw new KryptosError("Unsupported size");
  }
};
