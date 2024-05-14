import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../types";
import { _getEcEncryptionKeys } from "./ec/get-ec-keys";
import { _getOctEncryptionKeys } from "./oct/get-oct-keys";
import { _getRsaEncryptionKeys } from "./rsa/get-rsa-keys";

type Options = {
  encryption: AesEncryption;
  kryptos: Kryptos;
};

type EncryptionKeys = {
  encryptionKey: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};

export const _getEncryptionKeys = ({ encryption, kryptos }: Options): EncryptionKeys => {
  switch (kryptos.type) {
    case "EC":
      return _getEcEncryptionKeys({ encryption, kryptos });

    case "oct":
      return _getOctEncryptionKeys({ encryption, kryptos });

    case "RSA":
      return _getRsaEncryptionKeys({ encryption, kryptos });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { kryptos },
      });
  }
};
