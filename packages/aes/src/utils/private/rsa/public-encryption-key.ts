import { Kryptos } from "@lindorm/kryptos";
import { constants, privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import { AesError } from "../../../errors";
import { EncryptionKeyAlgorithm } from "../../../types";
import { _getOaepHash } from "./get-oaep-hash";

type EncryptOptions = {
  encryptionKey: Buffer;
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  kryptos: Kryptos;
};

type DecryptOptions = {
  encryptionKeyAlgorithm?: EncryptionKeyAlgorithm;
  kryptos: Kryptos;
  publicEncryptionKey: Buffer;
};

export const _createPublicEncryptionKey = ({
  encryptionKey,
  encryptionKeyAlgorithm,
  kryptos,
}: EncryptOptions): Buffer => {
  const { privateKey, publicKey } = kryptos.export("pem");

  if (encryptionKeyAlgorithm === "RSA-PRIVATE-KEY") {
    if (!privateKey) {
      throw new AesError("Unable to encrypt AES without private key");
    }

    return privateEncrypt(privateKey, encryptionKey);
  }

  if (
    encryptionKeyAlgorithm === "RSA-OAEP" ||
    encryptionKeyAlgorithm === "RSA-OAEP-256" ||
    encryptionKeyAlgorithm === "RSA-OAEP-384" ||
    encryptionKeyAlgorithm === "RSA-OAEP-512"
  ) {
    if (!publicKey) {
      throw new AesError("Unable to encrypt AES without public key");
    }

    return publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: _getOaepHash(encryptionKeyAlgorithm),
      },
      encryptionKey,
    );
  }

  throw new AesError("Invalid encryption key algorithm", {
    debug: { encryptionKeyAlgorithm, kryptos },
  });
};

export const _decryptPublicEncryptionKey = ({
  encryptionKeyAlgorithm,
  kryptos,
  publicEncryptionKey,
}: DecryptOptions): Buffer => {
  const { privateKey, publicKey } = kryptos.export("pem");

  if (encryptionKeyAlgorithm === "RSA-PRIVATE-KEY" && publicKey) {
    return publicDecrypt(publicKey, publicEncryptionKey);
  }

  if (
    encryptionKeyAlgorithm === "RSA-OAEP" ||
    encryptionKeyAlgorithm === "RSA-OAEP-256" ||
    encryptionKeyAlgorithm === "RSA-OAEP-384" ||
    encryptionKeyAlgorithm === "RSA-OAEP-512"
  ) {
    if (!privateKey) {
      throw new AesError("Unable to decrypt AES without private key");
    }

    return privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: _getOaepHash(encryptionKeyAlgorithm),
      },
      publicEncryptionKey,
    );
  }

  throw new AesError("Invalid encryption key algorithm", {
    debug: { encryptionKeyAlgorithm, kryptos },
  });
};
