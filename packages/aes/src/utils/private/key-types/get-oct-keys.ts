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
} from "../oct/get-oct-dir-keys";
import {
  _getOctKeyWrapDecryptionKey,
  _getOctKeyWrapEncryptionKey,
} from "../oct/get-oct-key-key-wrap";
import {
  _getOctPbkdfKeyWrapDecryptionKey,
  _getOctPbkdfKeyWrapEncryptionKey,
} from "../oct/get-oct-pbkdf-key-wrap-keys";

export const _getOctEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.algorithm) {
    case "dir":
      return _getOctDirEncryptionKey(options);

    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
      return _getOctKeyWrapEncryptionKey(options);

    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      return _getOctPbkdfKeyWrapEncryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};

export const _getOctDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  switch (options.kryptos.algorithm) {
    case "dir":
      return _getOctDirDecryptionKey(options);

    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
      return _getOctKeyWrapDecryptionKey(options);

    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      return _getOctPbkdfKeyWrapDecryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
