import { Kryptos } from "@lindorm/kryptos";
import { AesError } from "../../errors";
import { AesEncryption, PublicEncryptionJwk } from "../../types";
import { _getDiffieHellmanDecryptionKey } from "./encryption-keys/shared-secret";
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
    case "OKP":
      if (!publicEncryptionJwk || !salt) {
        throw new AesError("Invalid decryption data", {
          debug: { publicEncryptionJwk, salt },
        });
      }
      return _getDiffieHellmanDecryptionKey({
        encryption,
        publicEncryptionJwk,
        kryptos,
        salt,
      });

    case "RSA":
      if (!publicEncryptionKey) {
        throw new AesError("Invalid decryption data", {
          debug: { publicEncryptionKey },
        });
      }
      return _getRsaDecryptionKey({ publicEncryptionKey, kryptos });

    case "oct":
      if (!iterations || !salt) {
        throw new AesError("Invalid decryption data", {
          debug: { iterations, salt },
        });
      }
      return _getOctDecryptionKey({ encryption, iterations, kryptos, salt });

    default:
      throw new AesError("Unexpected key type", {
        debug: { kryptos },
      });
  }
};
