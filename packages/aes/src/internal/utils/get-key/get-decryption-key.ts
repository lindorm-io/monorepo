import { AesError } from "../../../errors";
import {
  DecryptCekOptions,
  DecryptCekResult,
} from "#internal/types/content-encryption-key";
import { getEcDecryptionKey } from "#internal/utils/key-types/get-ec-keys";
import { getOctDecryptionKey } from "#internal/utils/key-types/get-oct-keys";
import { getOkpDecryptionKey } from "#internal/utils/key-types/get-okp-keys";
import { getRsaDecryptionKey } from "#internal/utils/key-types/get-rsa-keys";

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
