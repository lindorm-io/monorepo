import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
} from "#internal/types/content-encryption-key";
import { getEcEncryptionKey } from "#internal/utils/key-types/get-ec-keys";
import { getOctEncryptionKey } from "#internal/utils/key-types/get-oct-keys";
import { getOkpEncryptionKey } from "#internal/utils/key-types/get-okp-keys";
import { getRsaEncryptionKey } from "#internal/utils/key-types/get-rsa-keys";

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
