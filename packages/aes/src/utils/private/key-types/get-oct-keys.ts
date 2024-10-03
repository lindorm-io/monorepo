import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import {
  getOctDirDecryptionKey,
  getOctDirEncryptionKey,
  getOctKeyWrapDecryptionKey,
  getOctKeyWrapEncryptionKey,
  getOctPbkdfKeyWrapDecryptionKey,
  getOctPbkdfKeyWrapEncryptionKey,
} from "../oct";

export const getOctEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.algorithm) {
    case "dir":
      return getOctDirEncryptionKey(options);

    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
      return getOctKeyWrapEncryptionKey(options);

    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      return getOctPbkdfKeyWrapEncryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};

export const getOctDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  switch (options.kryptos.algorithm) {
    case "dir":
      return getOctDirDecryptionKey(options);

    case "A128KW":
    case "A192KW":
    case "A256KW":
    case "A128GCMKW":
    case "A192GCMKW":
    case "A256GCMKW":
      return getOctKeyWrapDecryptionKey(options);

    case "PBES2-HS256+A128KW":
    case "PBES2-HS384+A192KW":
    case "PBES2-HS512+A256KW":
      return getOctPbkdfKeyWrapDecryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
