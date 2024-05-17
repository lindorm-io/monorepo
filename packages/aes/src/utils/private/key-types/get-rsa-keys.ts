import { IKryptos, Kryptos } from "@lindorm/kryptos";
import { RSA_PKCS1_OAEP_PADDING } from "constants";
import { privateDecrypt, publicEncrypt, randomBytes } from "crypto";
import { AesError } from "../../../errors";
import { AesEncryption } from "../../../types";
import { _calculateEncryptionKeyLength } from "../specific/calculate-encryption-key-length";
import { _rsaOaepHash } from "../specific/rsa-oaep-hash";

type EncryptOptions = {
  encryption: AesEncryption;
  kryptos: IKryptos;
};

type EncryptResult = {
  contentEncryptionKey: Buffer;
  publicEncryptionKey: Buffer;
};

type DecryptOptions = {
  kryptos: IKryptos;
  publicEncryptionKey: Buffer;
};

export const _getRsaEncryptionKey = ({
  encryption,
  kryptos,
}: EncryptOptions): EncryptResult => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new AesError("Invalid Kryptos instance");
  }

  if (
    kryptos.algorithm !== "RSA-OAEP" &&
    kryptos.algorithm !== "RSA-OAEP-256" &&
    kryptos.algorithm !== "RSA-OAEP-384" &&
    kryptos.algorithm !== "RSA-OAEP-512"
  ) {
    throw new AesError("Invalid encryption key algorithm");
  }

  const keyLength = _calculateEncryptionKeyLength(encryption);
  const contentEncryptionKey = randomBytes(keyLength);

  const { publicKey } = kryptos.export("pem");

  const publicEncryptionKey = publicEncrypt(
    {
      key: publicKey,
      padding: RSA_PKCS1_OAEP_PADDING,
      oaepHash: _rsaOaepHash(kryptos.algorithm),
    },
    contentEncryptionKey,
  );

  return { contentEncryptionKey, publicEncryptionKey };
};

export const _getRsaDecryptionKey = ({
  kryptos,
  publicEncryptionKey,
}: DecryptOptions): Buffer => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new AesError("Invalid Kryptos instance");
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
      oaepHash: _rsaOaepHash(kryptos.algorithm),
    },
    publicEncryptionKey,
  );
};
