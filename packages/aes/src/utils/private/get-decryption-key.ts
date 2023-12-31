import { KeySet } from "@lindorm-io/jwk";
import { AesError } from "../../errors";
import { Encryption, EncryptionKeyAlgorithm, PublicEncryptionJwk } from "../../types";
import { getEcDecryptionKey } from "./ec";
import { getOctDecryptionKey } from "./oct";
import { getRsaDecryptionKey } from "./rsa";

type Options = {
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  keySet: KeySet;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};

export const getDecryptionKey = ({
  encryption,
  encryptionKeyAlgorithm,
  keySet,
  publicEncryptionJwk,
  publicEncryptionKey,
}: Options): Buffer => {
  switch (keySet.type) {
    case "EC":
      if (!publicEncryptionJwk) {
        throw new AesError("Unable to decrypt AES cipher without public encryption JWK", {
          description: "Public encryption JWK is missing",
          debug: { publicEncryptionJwk },
        });
      }
      return getEcDecryptionKey({ encryption, keySet, publicEncryptionJwk });

    case "RSA":
      if (!publicEncryptionKey) {
        throw new AesError("Unable to decrypt AES cipher without public encryption key", {
          description: "Public encryption key is missing",
          debug: { publicEncryptionKey },
        });
      }
      return getRsaDecryptionKey({ encryptionKeyAlgorithm, keySet, publicEncryptionKey });

    case "oct":
      return getOctDecryptionKey({ encryption, keySet });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { keySet },
      });
  }
};
