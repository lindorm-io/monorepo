import { RsaKeySet } from "@lindorm-io/jwk";
import { constants, privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import { AesError } from "../../../errors";
import { EncryptionKeyAlgorithm } from "../../../types";
import { getOaepHash } from "./get-oaep-hash";

type EncryptOptions = {
  encryptionKey: Buffer;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  keySet: RsaKeySet;
};

type DecryptOptions = {
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  keySet: RsaKeySet;
  publicEncryptionKey: Buffer;
};

export const createPublicEncryptionKey = ({
  encryptionKey,
  encryptionKeyAlgorithm,
  keySet,
}: EncryptOptions): Buffer => {
  const { privateKey, publicKey } = keySet.export("pem");

  if (encryptionKeyAlgorithm === "RSA-PRIVATE-KEY") {
    if (!privateKey) {
      throw new AesError("Unable to encrypt AES without private key", {
        description: "Private key is missing",
        debug: { keySet },
      });
    }

    return privateEncrypt(privateKey, encryptionKey);
  }

  if (
    encryptionKeyAlgorithm === "RSA-OAEP" ||
    encryptionKeyAlgorithm === "RSA-OAEP-256" ||
    encryptionKeyAlgorithm === "RSA-OAEP-384" ||
    encryptionKeyAlgorithm === "RSA-OAEP-512"
  ) {
    return publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: getOaepHash(encryptionKeyAlgorithm),
      },
      encryptionKey,
    );
  }

  throw new AesError("Invalid encryption key algorithm", {
    description: "Encryption key algorithm is invalid",
    debug: { encryptionKeyAlgorithm, keySet },
  });
};

export const decryptPublicEncryptionKey = ({
  encryptionKeyAlgorithm,
  keySet,
  publicEncryptionKey,
}: DecryptOptions): Buffer => {
  const { privateKey, publicKey } = keySet.export("pem");

  if (encryptionKeyAlgorithm === "RSA-PRIVATE-KEY") {
    return publicDecrypt(publicKey, publicEncryptionKey);
  }

  if (
    encryptionKeyAlgorithm === "RSA-OAEP" ||
    encryptionKeyAlgorithm === "RSA-OAEP-256" ||
    encryptionKeyAlgorithm === "RSA-OAEP-384" ||
    encryptionKeyAlgorithm === "RSA-OAEP-512"
  ) {
    if (!privateKey) {
      throw new AesError("Unable to decrypt AES without private key", {
        description: "Private key is missing",
        debug: { keySet },
      });
    }

    return privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: getOaepHash(encryptionKeyAlgorithm),
      },
      publicEncryptionKey,
    );
  }

  throw new AesError("Invalid encryption key algorithm", {
    description: "Encryption key algorithm is invalid",
    debug: { encryptionKeyAlgorithm, keySet },
  });
};
