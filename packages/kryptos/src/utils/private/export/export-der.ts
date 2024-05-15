import { KryptosError } from "../../../errors";
import { KryptosDer } from "../../../types";
import { _ExportOptions } from "../../../types/private/export-options";
import { _isEcDer } from "../ec/is";
import { _isOctDer } from "../oct/is";
import { _isOkpDer } from "../okp/is";
import { _isRsaDer } from "../rsa/is";

export const _exportToDer = (options: _ExportOptions): KryptosDer => {
  switch (options.type) {
    case "EC":
      if (!_isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        algorithm: options.algorithm,
        curve: options.curve,
        privateKey: options.privateKey,
        publicKey: options.publicKey,
        type: options.type,
        use: options.use,
      };

    case "oct":
      if (!_isOctDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    case "OKP":
      if (!_isOkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        algorithm: options.algorithm,
        curve: options.curve,
        privateKey: options.privateKey,
        publicKey: options.publicKey,
        type: options.type,
        use: options.use,
      };

    case "RSA":
      if (!_isRsaDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: options.publicKey,
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Unsupported key type");
  }
};
