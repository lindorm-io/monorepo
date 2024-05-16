import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../types";
import { _getDiffieHellmanEncryptionKey } from "./encryption-keys/shared-secret";
import { _getOctEncryptionKeys } from "./oct/get-oct-keys";
import { _getRsaEncryptionKeys } from "./rsa/get-rsa-keys";

type Options = {
  encryption: AesEncryption;
  kryptos: Kryptos;
};

type EncryptionKeys = {
  encryptionKey: Buffer;
  iterations?: number;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  salt?: Buffer;
};

export const _getEncryptionKeys = ({ encryption, kryptos }: Options): EncryptionKeys => {
  switch (kryptos.type) {
    case "EC":
    case "OKP":
      return _getDiffieHellmanEncryptionKey({ encryption, kryptos });

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
