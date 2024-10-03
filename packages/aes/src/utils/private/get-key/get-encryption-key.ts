import { AesError } from "../../../errors";
import { CreateCekOptions, CreateCekResult } from "../../../types/private";
import {
  getEcEncryptionKey,
  getOctEncryptionKey,
  getOkpEncryptionKey,
  getRsaEncryptionKey,
} from "../key-types";

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
