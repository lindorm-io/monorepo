import { AesError } from "../../../errors/index.js";
import type {
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key.js";
import { getEcDecryptionKey } from "../key-types/get-ec-keys.js";
import { getOctDecryptionKey } from "../key-types/get-oct-keys.js";
import { getOkpDecryptionKey } from "../key-types/get-okp-keys.js";
import { getRsaDecryptionKey } from "../key-types/get-rsa-keys.js";

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
