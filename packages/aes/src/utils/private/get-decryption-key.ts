import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { AesEncryptionKey, AesSecret } from "../../types";
import { getRsaDecryptionKey } from "./rsa";
import { getSecretDecryptionKey } from "./secret";

type Options = {
  algorithm: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key?: AesEncryptionKey;
  publicEncryptionKey?: Buffer;
  secret?: AesSecret;
};

export const getDecryptionKey = ({
  algorithm,
  key,
  encryptionKeyAlgorithm,
  secret,
  publicEncryptionKey,
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

  if (!publicEncryptionKey) {
    throw new AesError("Unable to decrypt AES cipher without public encryption key", {
      description: "Public encryption key is missing",
      debug: { publicEncryptionKey },
    });
  }

  switch (key.type) {
    case "EC":
      throw new AesError("Unable to decrypt AES cipher with EC encryption key", {
        description: "EC encryption keys are not supported",
        debug: { key },
      });

    case "RSA":
      return getRsaDecryptionKey({ key, encryptionKeyAlgorithm, publicEncryptionKey });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { key },
      });
  }
};
