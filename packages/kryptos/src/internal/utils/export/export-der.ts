import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer } from "../../../types/index.js";
import type { ExportOptions } from "../../types/export-options.js";
import { isAkpDer } from "../akp/is.js";
import { isEcDer } from "../ec/is.js";
import { isOctDer } from "../oct/is.js";
import { isOkpDer } from "../okp/is.js";
import { isRsaDer } from "../rsa/is.js";

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
