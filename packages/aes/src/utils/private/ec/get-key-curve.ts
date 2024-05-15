import { EcCurve } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { AesCurve } from "../../../types";

export const _getKeyCurve = (curve: EcCurve | AesCurve): AesCurve => {
  switch (curve) {
    case "P-256":
    case "secp256k1":
      return "secp256k1";

    case "P-384":
    case "secp384r1":
      return "secp384r1";

    case "P-521":
    case "secp521r1":
      return "secp521r1";

    default:
      throw new AesError("Unsupported curve");
  }
};

export const _getNistCurve = (curve: EcCurve | AesCurve): EcCurve => {
  switch (curve) {
    case "P-256":
    case "secp256k1":
      return "P-256";

    case "P-384":
    case "secp384r1":
      return "P-384";

    case "P-521":
    case "secp521r1":
      return "P-521";

    default:
      throw new AesError("Unsupported curve");
  }
};
