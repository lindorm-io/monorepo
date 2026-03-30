import { KryptosError } from "../../../errors";
import { KryptosAlgorithm, RsaModulus } from "../../../types";

type Options = {
  algorithm: KryptosAlgorithm;
};

export const getRsaModulus = (options: Options): RsaModulus => {
  switch (options.algorithm) {
    case "RSA-OAEP":
      return 2048;

    case "PS256":
    case "RS256":
    case "RSA-OAEP-256":
      return 2048;

    case "PS384":
    case "RS384":
    case "RSA-OAEP-384":
      return 3072;

    case "PS512":
    case "RS512":
    case "RSA-OAEP-512":
      return 4096;

    default:
      throw new KryptosError("Unsupported algorithm");
  }
};
