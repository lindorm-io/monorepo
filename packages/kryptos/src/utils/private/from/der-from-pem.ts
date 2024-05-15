import { KryptosError } from "../../../errors";
import { KryptosDer, KryptosPem } from "../../../types";
import { _createEcDerFromPem } from "../ec/der-from-pem";
import { _createOctDerFromPem } from "../oct/der-from-pem";
import { _createOkpDerFromPem } from "../okp/der-from-pem";
import { _createRsaDerFromPem } from "../rsa/der-from-pem";

export const _createDerFromPem = (options: KryptosPem): KryptosDer => {
  switch (options.type) {
    case "EC":
      return {
        ..._createEcDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "oct":
      return {
        ..._createOctDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "OKP":
      return {
        ..._createOkpDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "RSA":
      return {
        ..._createRsaDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
