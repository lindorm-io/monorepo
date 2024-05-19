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

export const _getOkpEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.algorithm) {
    case "ECDH-ES":
      return _getDiffieHellmanEncryptionKey(options);

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

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
