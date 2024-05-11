import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../errors";
import { Encryption, EncryptionKeyAlgorithm, PublicEncryptionJwk } from "../../types";
import { _getEcDecryptionKey } from "./ec/get-ec-keys";
import { _getOctDecryptionKey } from "./oct/get-oct-keys";
import { _getRsaDecryptionKey } from "./rsa/get-rsa-keys";

type Options = {
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  kryptos: Kryptos;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};

export const _getDecryptionKey = ({
  encryption,
  encryptionKeyAlgorithm,
  kryptos,
  publicEncryptionJwk,
  publicEncryptionKey,
}: Options): Buffer => {
  switch (kryptos.type) {
    case "EC":
      if (!publicEncryptionJwk) {
        throw new AesError("Unable to decrypt AES cipher without public encryption JWK", {
          debug: { publicEncryptionJwk },
        });
      }
      return _getEcDecryptionKey({ encryption, kryptos, publicEncryptionJwk });

    case "RSA":
      if (!publicEncryptionKey) {
        throw new AesError("Unable to decrypt AES cipher without public encryption key", {
          debug: { publicEncryptionKey },
        });
      }
      return _getRsaDecryptionKey({ encryptionKeyAlgorithm, kryptos, publicEncryptionKey });

    case "oct":
      return _getOctDecryptionKey({ encryption, kryptos });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { kryptos },
      });
  }
};
