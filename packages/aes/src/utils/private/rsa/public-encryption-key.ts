import { Kryptos } from "@lindorm/kryptos";
import { constants, privateDecrypt, privateEncrypt, publicDecrypt, publicEncrypt } from "crypto";
import { AesError } from "../../../errors";
import { _getOaepHash } from "./get-oaep-hash";

type EncryptOptions = {
  encryptionKey: Buffer;
  kryptos: Kryptos;
};

type DecryptOptions = {
  publicEncryptionKey: Buffer;
  kryptos: Kryptos;
};

export const _createPublicEncryptionKey = ({ encryptionKey, kryptos }: EncryptOptions): Buffer => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new AesError("Invalid kryptos type");
  }

  const { privateKey, publicKey } = kryptos.export("pem");

  if (kryptos.algorithm === "RSA-PRIVATE-KEY") {
    if (!privateKey) {
      throw new AesError("Unable to encrypt AES without private key");
    }

    return privateEncrypt(privateKey, encryptionKey);
  }

  if (
    kryptos.algorithm === "RSA-OAEP" ||
    kryptos.algorithm === "RSA-OAEP-256" ||
    kryptos.algorithm === "RSA-OAEP-384" ||
    kryptos.algorithm === "RSA-OAEP-512"
  ) {
    if (!publicKey) {
      throw new AesError("Unable to encrypt AES without public key");
    }

    return publicEncrypt(
      {
        key: publicKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: _getOaepHash(kryptos.algorithm),
      },
      encryptionKey,
    );
  }

  throw new AesError("Invalid encryption key algorithm", {
    debug: { kryptos },
  });
};

export const _decryptPublicEncryptionKey = ({
  publicEncryptionKey,
  kryptos,
}: DecryptOptions): Buffer => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new AesError("Invalid kryptos type");
  }

  const { privateKey, publicKey } = kryptos.export("pem");

  if (kryptos.algorithm === "RSA-PRIVATE-KEY" && publicKey) {
    return publicDecrypt(publicKey, publicEncryptionKey);
  }

  if (
    kryptos.algorithm === "RSA-OAEP" ||
    kryptos.algorithm === "RSA-OAEP-256" ||
    kryptos.algorithm === "RSA-OAEP-384" ||
    kryptos.algorithm === "RSA-OAEP-512"
  ) {
    if (!privateKey) {
      throw new AesError("Unable to decrypt AES without private key");
    }

    return privateDecrypt(
      {
        key: privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: _getOaepHash(kryptos.algorithm),
      },
      publicEncryptionKey,
    );
  }

  throw new AesError("Invalid encryption key algorithm", {
    debug: { kryptos },
  });
};
