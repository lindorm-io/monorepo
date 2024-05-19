import { AesError } from "../../../errors";
import { CreateCekOptions, CreateCekResult } from "../../../types/private";
import { _getEcEncryptionKey } from "../key-types/get-ec-keys";
import { _getOctEncryptionKey } from "../key-types/get-oct-keys";
import { _getOkpEncryptionKey } from "../key-types/get-okp-keys";
import { _getRsaEncryptionKey } from "../key-types/get-rsa-keys";

export const _getEncryptionKey = (options: CreateCekOptions): CreateCekResult => {
  switch (options.kryptos.type) {
    case "EC":
      return _getEcEncryptionKey(options);

    case "oct":
      return _getOctEncryptionKey(options);

    case "OKP":
      return _getOkpEncryptionKey(options);

    case "RSA":
      return _getRsaEncryptionKey(options);

    default:
      throw new AesError("Unexpected Kryptos", {
        debug: { kryptos: options.kryptos.toJSON() },
      });
  }
};
