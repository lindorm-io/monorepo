import { AesError } from "../../../errors";
import { DecryptCekOptions, DecryptCekResult } from "../../../types/private";
import { getEcDecryptionKey } from "../key-types/get-ec-keys";
import { getOctDecryptionKey } from "../key-types/get-oct-keys";
import { getOkpDecryptionKey } from "../key-types/get-okp-keys";
import { getRsaDecryptionKey } from "../key-types/get-rsa-keys";

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
