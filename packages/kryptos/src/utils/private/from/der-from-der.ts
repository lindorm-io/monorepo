import { KryptosError } from "../../../errors";
import { KryptosDer } from "../../../types";
import { _createEcDerFromDer } from "../ec/der-from-der";
import { _createOkpDerFromDer } from "../okp/der-from-der";
import { _createRsaDerFromDer } from "../rsa/der-from-der";

export const _createDerFromDer = (options: KryptosDer): KryptosDer => {
  switch (options.type) {
    case "EC":
      return {
        ..._createEcDerFromDer(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "oct":
      return {
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    case "OKP":
      return {
        ..._createOkpDerFromDer(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "RSA":
      return {
        ..._createRsaDerFromDer(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
