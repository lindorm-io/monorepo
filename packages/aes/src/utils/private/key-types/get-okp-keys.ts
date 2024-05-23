import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import {
  getDiffieHellmanDecryptionKey,
  getDiffieHellmanEncryptionKey,
} from "../diffie-hellman/diffie-hellman";
import {
  getDiffieHellmanKeyWrapDecryptionKey,
  getDiffieHellmanKeyWrapEncryptionKey,
} from "../diffie-hellman/diffie-hellman-key-wrap";

export const getOkpEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.algorithm) {
    case "ECDH-ES":
      return getDiffieHellmanEncryptionKey(options);

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      return getDiffieHellmanKeyWrapEncryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};

export const getOkpDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  switch (options.kryptos.algorithm) {
    case "ECDH-ES":
      return getDiffieHellmanDecryptionKey(options);

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      return getDiffieHellmanKeyWrapDecryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
