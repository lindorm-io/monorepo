import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosString } from "../../../types/index.js";
import { createAkpDerFromB64 } from "../akp/der-from-b64.js";
import { createEcDerFromB64 } from "../ec/der-from-b64.js";
import { createOkpDerFromB64 } from "../okp/der-from-b64.js";
import { createRsaDerFromB64 } from "../rsa/der-from-b64.js";

export const createDerFromB64 = (options: KryptosString): KryptosBuffer => {
  switch (options.type) {
    case "AKP":
      return {
        ...createAkpDerFromB64(options),
        id: options.id,
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "EC":
      return {
        ...createEcDerFromB64(options),
        id: options.id,
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "oct":
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: options.privateKey
          ? Buffer.from(options.privateKey, "base64url")
          : Buffer.alloc(0),
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    case "OKP":
      return {
        ...createOkpDerFromB64(options),
        id: options.id,
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "RSA":
      return {
        ...createRsaDerFromB64(options),
        id: options.id,
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
