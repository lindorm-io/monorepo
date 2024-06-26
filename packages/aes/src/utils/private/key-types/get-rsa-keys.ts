import { Kryptos } from "@lindorm/kryptos";
import { RSA_PKCS1_OAEP_PADDING } from "constants";
import { privateDecrypt, publicEncrypt, randomBytes } from "crypto";
import { AesError } from "../../../errors";
import {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../../types/private";
import { _calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size";
import { _calculateRsaOaepHash } from "../calculate/calculate-rsa-oaep-hash";

export const _getRsaEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
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

  const keyLength = _calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(keyLength);

  const { publicKey } = kryptos.export("pem");

  const publicEncryptionKey = publicEncrypt(
    {
      key: publicKey,
      padding: RSA_PKCS1_OAEP_PADDING,
      oaepHash: _calculateRsaOaepHash(kryptos.algorithm),
    },
    contentEncryptionKey,
  );

  return { contentEncryptionKey, publicEncryptionKey };
};

export const _getRsaDecryptionKey = ({
  kryptos,
  publicEncryptionKey,
}: DecryptCekOptions): DecryptCekResult => {
  if (!Kryptos.isRsa(kryptos)) {
    throw new AesError("Invalid Kryptos instance");
  }
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey");
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

  const contentEncryptionKey = privateDecrypt(
    {
      key: privateKey,
      padding: RSA_PKCS1_OAEP_PADDING,
      oaepHash: _calculateRsaOaepHash(kryptos.algorithm),
    },
    publicEncryptionKey,
  );

  return { contentEncryptionKey };
};
