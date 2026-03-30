import { KryptosError } from "../../../errors";
import { KryptosBuffer } from "../../../types";
import { createEcDerFromDer } from "../ec/der-from-der";
import { createOkpDerFromDer } from "../okp/der-from-der";
import { createRsaDerFromDer } from "../rsa/der-from-der";

export const createDerFromDer = (options: KryptosBuffer): KryptosBuffer => {
  switch (options.type) {
    case "EC":
      return {
        ...createEcDerFromDer(options),
        id: options.id,
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "oct":
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    case "OKP":
      return {
        ...createOkpDerFromDer(options),
        id: options.id,
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "RSA":
      return {
        ...createRsaDerFromDer(options),
        id: options.id,
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
