import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import {
  _getDiffieHellmanDecryptionKey,
  _getDiffieHellmanEncryptionKey,
} from "../diffie-hellman/diffie-hellman";
import {
  _getDiffieHellmanKeyWrapDecryptionKey,
  _getDiffieHellmanKeyWrapEncryptionKey,
} from "../diffie-hellman/diffie-hellman-key-wrap";

export const _getOkpEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.algorithm) {
    case "ECDH-ES":
      return _getDiffieHellmanEncryptionKey(options);

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      return _getDiffieHellmanKeyWrapEncryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};

export const _getOkpDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  switch (options.kryptos.algorithm) {
    case "ECDH-ES":
      return _getDiffieHellmanDecryptionKey(options);

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
    case "ECDH-ES+A128GCMKW":
    case "ECDH-ES+A192GCMKW":
    case "ECDH-ES+A256GCMKW":
      return _getDiffieHellmanKeyWrapDecryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
