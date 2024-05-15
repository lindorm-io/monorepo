import { KryptosError } from "../../../errors";
import { KryptosCurve } from "../../../types";

export const _getCurveLength = (curve: KryptosCurve): number => {
  switch (curve) {
    case "P-256":
      return 64;

    case "P-384":
      return 96;

    case "P-521":
      return 132;

    default:
      throw new KryptosError("Unsupported curve");
  }
};
