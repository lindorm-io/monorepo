import { KryptosError } from "../../../errors";
import { KryptosDer } from "../../../types";
import { ExportOptions } from "../../../types/private";
import { isEcDer } from "../ec";
import { isOctDer } from "../oct";
import { isOkpDer } from "../okp";
import { isRsaDer } from "../rsa";

export const exportToDer = (options: ExportOptions): KryptosDer => {
  switch (options.type) {
    case "EC":
      if (!isEcDer(options)) {
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
      if (!isOctDer(options)) {
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
      if (!isOkpDer(options)) {
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
      if (!isRsaDer(options)) {
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
