import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer } from "../../../types/index.js";
import { createAkpDerFromDer } from "../akp/der-from-der.js";
import { createEcDerFromDer } from "../ec/der-from-der.js";
import { createOkpDerFromDer } from "../okp/der-from-der.js";
import { createRsaDerFromDer } from "../rsa/der-from-der.js";

export const createDerFromDer = (options: KryptosBuffer): KryptosBuffer => {
  switch (options.type) {
    case "AKP":
      return {
        ...createAkpDerFromDer(options),
        id: options.id,
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

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
