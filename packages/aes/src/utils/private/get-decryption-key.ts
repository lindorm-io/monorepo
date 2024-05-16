import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../types";
import { _getEcDecryptionKey } from "./ec/get-ec-keys";
import { _getOctDecryptionKey } from "./oct/get-oct-keys";
import { _getRsaDecryptionKey } from "./rsa/get-rsa-keys";

type Options = {
  encryption: AesEncryption;
  iterations?: number;
  kryptos: Kryptos;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  salt?: Buffer;
};

export const _getDecryptionKey = ({
  encryption,
  iterations,
  kryptos,
  publicEncryptionJwk,
  publicEncryptionKey,
  salt,
}: Options): Buffer => {
  switch (kryptos.type) {
    case "EC":
      if (!publicEncryptionJwk) {
        throw new AesError("Unable to decrypt AES cipher without public encryption JWK", {
          debug: { publicEncryptionJwk },
        });
      }
      return _getEcDecryptionKey({ encryption, publicEncryptionJwk, kryptos });

    case "RSA":
      if (!publicEncryptionKey) {
        throw new AesError("Unable to decrypt AES cipher without public encryption key", {
          debug: { publicEncryptionKey },
        });
      }
      return _getRsaDecryptionKey({ publicEncryptionKey, kryptos });

    case "oct":
      if (!iterations || !salt) {
        throw new AesError("Unable to decrypt AES cipher without iterations and salt", {
          debug: { iterations, salt },
        });
      }
      return _getOctDecryptionKey({ encryption, iterations, kryptos, salt });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { kryptos },
      });
  }
};
