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
} from "../specific/diffie-hellman";
import {
  _getDiffieHellmanKeyWrapDecryptionKey,
  _getDiffieHellmanKeyWrapEncryptionKey,
} from "../specific/diffie-hellman-key-wrap";

export const _getEcEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.algorithm) {
    case "ECDH-ES":
      return _getDiffieHellmanEncryptionKey(options);

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
      return _getDiffieHellmanKeyWrapEncryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};

export const _getEcDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  switch (options.kryptos.algorithm) {
    case "ECDH-ES":
      return _getDiffieHellmanDecryptionKey(options);

    case "ECDH-ES+A128KW":
    case "ECDH-ES+A192KW":
    case "ECDH-ES+A256KW":
      return _getDiffieHellmanKeyWrapDecryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
