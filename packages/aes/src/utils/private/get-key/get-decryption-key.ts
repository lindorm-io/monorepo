import { AesError } from "../../../errors";
import { DecryptCekOptions, DecryptCekResult } from "../../../types/private";
import { _getEcDecryptionKey } from "../key-types/get-ec-keys";
import { _getOctDecryptionKey } from "../key-types/get-oct-keys";
import { _getOkpDecryptionKey } from "../key-types/get-okp-keys";
import { _getRsaDecryptionKey } from "../key-types/get-rsa-keys";

export const _getDecryptionKey = (options: DecryptCekOptions): DecryptCekResult => {
  switch (options.kryptos.type) {
    case "EC":
      return _getEcDecryptionKey(options);

    case "oct":
      return _getOctDecryptionKey(options);

    case "OKP":
      return _getOkpDecryptionKey(options);

    case "RSA":
      return _getRsaDecryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
