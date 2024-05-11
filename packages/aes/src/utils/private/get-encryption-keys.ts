import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../errors";
import { Encryption, EncryptionKeyAlgorithm, PublicEncryptionJwk } from "../../types";
import { _getEcEncryptionKeys } from "./ec/get-ec-keys";
import { _getOctEncryptionKeys } from "./oct/get-oct-keys";
import { _getRsaEncryptionKeys } from "./rsa/get-rsa-keys";

type Options = {
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  kryptos: Kryptos;
};

type EncryptionKeys = {
  encryptionKey: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};

export const _getEncryptionKeys = ({
  encryption,
  encryptionKeyAlgorithm,
  kryptos,
}: Options): EncryptionKeys => {
  switch (kryptos.type) {
    case "EC":
      return _getEcEncryptionKeys({ encryption, encryptionKeyAlgorithm, kryptos });

    case "RSA":
      return _getRsaEncryptionKeys({ encryption, encryptionKeyAlgorithm, kryptos });

    case "oct":
      return _getOctEncryptionKeys({ encryption, kryptos });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { kryptos },
      });
  }
};
