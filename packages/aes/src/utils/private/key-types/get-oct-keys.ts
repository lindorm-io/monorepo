import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import {
  _getOctDirDecryptionKey,
  _getOctDirEncryptionKey,
} from "../specific/get-oct-dir-keys";
import {
  _getOctKeyWrapDecryptionKey,
  _getOctKeyWrapEncryptionKey,
} from "../specific/get-oct-key-wrap-keys";

export const _getOctEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.algorithm) {
    case "A128KW":
    case "A192KW":
    case "A256KW":
      return _getOctKeyWrapEncryptionKey(options);

    case "dir":
      return _getOctDirEncryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};

export const _getOctDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  switch (options.kryptos.algorithm) {
    case "A128KW":
    case "A192KW":
    case "A256KW":
      return _getOctKeyWrapDecryptionKey(options);

    case "dir":
      return _getOctDirDecryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
