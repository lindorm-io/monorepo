import { IKryptos } from "@lindorm/kryptos";
import { AesError } from "../../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../../types";
import { _getEcEncryptionKey } from "../key-types/get-ec-keys";
import { _getOctEncryptionKey } from "../key-types/get-oct-keys";
import { _getOkpEncryptionKey } from "../key-types/get-okp-keys";
import { _getRsaEncryptionKey } from "../key-types/get-rsa-keys";

type Options = {
  encryption: AesEncryption;
  kryptos: IKryptos;
};

type EncryptionKeys = {
  contentEncryptionKey: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  salt?: Buffer;
};

export const _getEncryptionKey = (options: Options): EncryptionKeys => {
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
      throw new AesError("Unexpected encryption key type");
  }
};
