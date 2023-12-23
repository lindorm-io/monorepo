import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../../enums";
import { AesError } from "../../errors";
import { AesEncryptionKey, AesPublicJwk, AesSecret } from "../../types";
import { getEcEncryptionKeys } from "./ec";
import { getKeyType } from "./get-key-type";
import { getOctEncryptionKeys } from "./oct";
import { getRsaEncryptionKeys } from "./rsa";
import { getSecretEncryptionKeys } from "./secret";

type Options = {
  algorithm: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key?: AesEncryptionKey;
  secret?: AesSecret;
};

type EncryptionKeys = {
  encryptionKey: Buffer;
  publicEncryptionJwk?: AesPublicJwk;
  publicEncryptionKey?: Buffer;
};

export const getEncryptionKeys = ({
  algorithm,
  encryptionKeyAlgorithm,
  key,
  secret,
}: Options): EncryptionKeys => {
  if (key && secret) {
    throw new AesError("Unable to encrypt AES cipher with both key and secret", {
      description: "Key and secret are both present",
      debug: { key, secret },
    });
  }

  if (secret) {
    return getSecretEncryptionKeys({ algorithm, secret });
  }

  if (!key) {
    throw new AesError("Unable to encrypt AES cipher without key OR secret", {
      description: "Key is missing",
      debug: { key },
    });
  }

  switch (getKeyType(key)) {
    case "EC":
      return getEcEncryptionKeys({ algorithm, encryptionKeyAlgorithm, key });

    case "RSA":
      return getRsaEncryptionKeys({ algorithm, encryptionKeyAlgorithm, key });

    case "oct":
      return getOctEncryptionKeys({ algorithm, key });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { key },
      });
  }
};
