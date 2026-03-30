import { KryptosError } from "../../../errors";
import { KryptosBuffer, KryptosString } from "../../../types";
import { createEcDerFromB64 } from "../ec/der-from-b64";
import { createOkpDerFromB64 } from "../okp/der-from-b64";
import { createRsaDerFromB64 } from "../rsa/der-from-b64";

export const createDerFromB64 = (options: KryptosString): KryptosBuffer => {
  switch (options.type) {
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
