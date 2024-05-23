import { AesError } from "../../../errors";
import { CreateCekOptions, CreateCekResult } from "../../../types/private";
import { getEcEncryptionKey } from "../key-types/get-ec-keys";
import { getOctEncryptionKey } from "../key-types/get-oct-keys";
import { getOkpEncryptionKey } from "../key-types/get-okp-keys";
import { getRsaEncryptionKey } from "../key-types/get-rsa-keys";

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
