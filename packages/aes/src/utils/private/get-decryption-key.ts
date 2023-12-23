import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { AesEncryptionKey, AesPublicJwk, AesSecret } from "../../types";
import { getEcDecryptionKey } from "./ec";
import { getKeyType } from "./get-key-type";
import { getOctDecryptionKey } from "./oct";
import { getRsaDecryptionKey } from "./rsa";
import { getSecretDecryptionKey } from "./secret";

type Options = {
  algorithm: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key?: AesEncryptionKey;
  publicEncryptionJwk?: AesPublicJwk;
  publicEncryptionKey?: Buffer;
  secret?: AesSecret;
};

export const getDecryptionKey = ({
  algorithm,
  encryptionKeyAlgorithm,
  key,
  publicEncryptionJwk,
  publicEncryptionKey,
  secret,
}: Options): Buffer => {
  if (key && secret) {
    throw new AesError("Unable to decrypt AES cipher with both key and secret", {
      description: "Key and secret are both present",
      debug: { key, secret },
    });
  }

  if (secret) {
    return getSecretDecryptionKey({ algorithm, secret });
  }

  if (!key) {
    throw new AesError("Unable to decrypt AES cipher without key OR secret", {
      description: "Key is missing",
      debug: { key },
    });
  }

  switch (getKeyType(key)) {
    case "EC":
      if (!publicEncryptionJwk) {
        throw new AesError("Unable to decrypt AES cipher without public encryption JWK", {
          description: "Public encryption JWK is missing",
          debug: { publicEncryptionJwk },
        });
      }
      return getEcDecryptionKey({ algorithm, key, publicEncryptionJwk });

    case "RSA":
      if (!publicEncryptionKey) {
        throw new AesError("Unable to decrypt AES cipher without public encryption key", {
          description: "Public encryption key is missing",
          debug: { publicEncryptionKey },
        });
      }
      return getRsaDecryptionKey({ key, encryptionKeyAlgorithm, publicEncryptionKey });

    case "oct":
      return getOctDecryptionKey({ algorithm, key });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { key },
      });
  }
};
