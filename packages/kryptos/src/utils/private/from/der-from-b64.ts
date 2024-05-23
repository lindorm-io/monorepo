import { KryptosError } from "../../../errors";
import { KryptosB64, KryptosDer } from "../../../types";
import { createEcDerFromB64 } from "../ec/der-from-b64";
import { createOkpDerFromB64 } from "../okp/der-from-b64";
import { createRsaDerFromB64 } from "../rsa/der-from-b64";

export const createDerFromB64 = (options: KryptosB64): KryptosDer => {
  switch (options.type) {
    case "EC":
      return {
        ...createEcDerFromB64(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "oct":
      return {
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
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "RSA":
      return {
        ...createRsaDerFromB64(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
