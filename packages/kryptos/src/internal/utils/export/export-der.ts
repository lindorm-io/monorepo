import { KryptosError } from "../../../errors";
import { KryptosBuffer } from "../../../types";
import { ExportOptions } from "../../types/export-options";
import { isAkpDer } from "../akp/is";
import { isEcDer } from "../ec/is";
import { isOctDer } from "../oct/is";
import { isOkpDer } from "../okp/is";
import { isRsaDer } from "../rsa/is";

export const exportToDer = (options: ExportOptions): KryptosBuffer => {
  switch (options.type) {
    case "AKP":
      if (!isAkpDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: options.publicKey,
        type: options.type,
        use: options.use,
      };

    case "EC":
      if (!isEcDer(options)) {
        throw new KryptosError("Invalid options");
      }
      return {
        id: options.id,
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
        id: options.id,
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
        id: options.id,
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
        id: options.id,
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
