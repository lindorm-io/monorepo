import { EcJwkValues, SpecificEllipticCurve } from "@lindorm-io/jwk";
import { AesError } from "../../../errors";

export const getKeyCurve = (key: EcJwkValues): SpecificEllipticCurve => {
  switch (key.crv) {
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
