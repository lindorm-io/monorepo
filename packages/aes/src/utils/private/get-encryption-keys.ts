import { KeySet } from "@lindorm-io/jwk";
import { AesError } from "../../errors";
import { Encryption, EncryptionKeyAlgorithm, PublicEncryptionJwk } from "../../types";
import { getEcEncryptionKeys } from "./ec";
import { getOctEncryptionKeys } from "./oct";
import { getRsaEncryptionKeys } from "./rsa";

type Options = {
  encryption: Encryption;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  keySet: KeySet;
};

type EncryptionKeys = {
  encryptionKey: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
};

export const getEncryptionKeys = ({
  encryption,
  encryptionKeyAlgorithm,
  keySet,
}: Options): EncryptionKeys => {
  switch (keySet.type) {
    case "EC":
      return getEcEncryptionKeys({ encryption, encryptionKeyAlgorithm, keySet });

    case "RSA":
      return getRsaEncryptionKeys({ encryption, encryptionKeyAlgorithm, keySet });

    case "oct":
      return getOctEncryptionKeys({ encryption, keySet });

    default:
      throw new AesError("Unexpected encryption key type", {
        debug: { keySet },
      });
  }
};
