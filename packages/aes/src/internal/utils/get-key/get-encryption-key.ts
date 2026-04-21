import { AesError } from "../../../errors/index.js";
import type {
  CreateCekOptions,
  CreateCekResult,
} from "../../types/content-encryption-key.js";
import { getEcEncryptionKey } from "../key-types/get-ec-keys.js";
import { getOctEncryptionKey } from "../key-types/get-oct-keys.js";
import { getOkpEncryptionKey } from "../key-types/get-okp-keys.js";
import { getRsaEncryptionKey } from "../key-types/get-rsa-keys.js";

export const getEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.type) {
    case "EC":
      return getEcEncryptionKey(options);

    case "oct":
      return getOctEncryptionKey(options);

    case "OKP":
      return getOkpEncryptionKey(options);

    case "RSA":
      return getRsaEncryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
