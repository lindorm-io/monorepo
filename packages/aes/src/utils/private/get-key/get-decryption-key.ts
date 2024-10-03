import { AesError } from "../../../errors";
import { DecryptCekOptions, DecryptCekResult } from "../../../types/private";
import {
  getEcDecryptionKey,
  getOctDecryptionKey,
  getOkpDecryptionKey,
  getRsaDecryptionKey,
} from "../key-types";

export const getDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  switch (options.kryptos.type) {
    case "EC":
      return getEcDecryptionKey(options);

    case "oct":
      return getOctDecryptionKey(options);

    case "OKP":
      return getOkpDecryptionKey(options);

    case "RSA":
      return getRsaDecryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
