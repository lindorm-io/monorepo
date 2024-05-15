import { KryptosError } from "../../../errors";
import { KryptosDer } from "../../../types";
import { _createEcDerFromRaw } from "../ec/der-from-raw";

export const _createDerFromRaw = (options: KryptosDer): KryptosDer => {
  switch (options.type) {
    case "EC":
      return {
        ..._createEcDerFromRaw(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "oct":
    case "OKP":
    case "RSA":
      throw new KryptosError("Raw import not supported for this key type");

    default:
      throw new KryptosError("Invalid key type");
  }
};
