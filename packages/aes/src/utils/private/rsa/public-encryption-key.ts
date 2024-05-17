import { Kryptos } from "@lindorm/kryptos";
import { RSA_PKCS1_OAEP_PADDING } from "constants";
import { privateDecrypt, publicEncrypt } from "crypto";
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

export const _createPublicEncryptionKey = ({
  encryptionKey,
  kryptos,
}: EncryptOptions): Buffer => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new AesError("Invalid kryptos type");
  }

  if (
    kryptos.algorithm !== "RSA-OAEP" &&
    kryptos.algorithm !== "RSA-OAEP-256" &&
    kryptos.algorithm !== "RSA-OAEP-384" &&
    kryptos.algorithm !== "RSA-OAEP-512"
  ) {
    throw new AesError("Invalid encryption key algorithm", {
      debug: { kryptos },
    });
  }

  const { publicKey } = kryptos.export("pem");

  if (!publicKey) {
    throw new AesError("Unable to encrypt AES without public key");
  }

  return publicEncrypt(
    {
      key: publicKey,
      padding: RSA_PKCS1_OAEP_PADDING,
      oaepHash: _getOaepHash(kryptos.algorithm),
    },
    encryptionKey,
  );
};

export const _decryptPublicEncryptionKey = ({
  publicEncryptionKey,
  kryptos,
}: DecryptOptions): Buffer => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new AesError("Invalid kryptos type");
  }

  if (
    kryptos.algorithm !== "RSA-OAEP" &&
    kryptos.algorithm !== "RSA-OAEP-256" &&
    kryptos.algorithm !== "RSA-OAEP-384" &&
    kryptos.algorithm !== "RSA-OAEP-512"
  ) {
    throw new AesError("Invalid encryption key algorithm", {
      debug: { kryptos },
    });
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new AesError("Unable to decrypt AES without private key");
  }

  return privateDecrypt(
    {
      key: privateKey,
      padding: RSA_PKCS1_OAEP_PADDING,
      oaepHash: _getOaepHash(kryptos.algorithm),
    },
    publicEncryptionKey,
  );
};
