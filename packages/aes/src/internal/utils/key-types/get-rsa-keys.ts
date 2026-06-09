import { KryptosKit } from "@lindorm/kryptos";
import { RSA_PKCS1_OAEP_PADDING } from "constants";
import { privateDecrypt, publicEncrypt, randomBytes } from "crypto";
import { AesError } from "../../../errors/index.js";
import type {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key.js";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size.js";
import { calculateRsaOaepHash } from "../calculate/calculate-rsa-oaep-hash.js";

export const getRsaEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!KryptosKit.isRsa(kryptos)) {
    throw new AesError("Invalid Kryptos instance", {
      code: "invalid_kryptos",
      title: "Invalid Kryptos",
      details: "RSA-OAEP encryption requires an RSA Kryptos key type.",
    });
  }

  if (
    kryptos.algorithm !== "RSA-OAEP" &&
    kryptos.algorithm !== "RSA-OAEP-256" &&
    kryptos.algorithm !== "RSA-OAEP-384" &&
    kryptos.algorithm !== "RSA-OAEP-512"
  ) {
    throw new AesError("Invalid encryption key algorithm", {
      code: "invalid_key_algorithm",
      title: "Invalid Key Algorithm",
      details:
        "RSA encryption requires an RSA-OAEP algorithm variant (RSA-OAEP, RSA-OAEP-256, RSA-OAEP-384, or RSA-OAEP-512).",
      data: { algorithm: kryptos.algorithm },
    });
  }

  const keyLength = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(keyLength);

  const { publicKey } = kryptos.export("pem");

  const publicEncryptionKey = publicEncrypt(
    {
      key: publicKey,
      padding: RSA_PKCS1_OAEP_PADDING,
      oaepHash: calculateRsaOaepHash(kryptos.algorithm),
    },
    contentEncryptionKey,
  );

  return { contentEncryptionKey, publicEncryptionKey };
};

export const getRsaDecryptionKey = ({
  kryptos,
  publicEncryptionKey,
}: DecryptCekOptions): DecryptCekResult => {
  if (!KryptosKit.isRsa(kryptos)) {
    throw new AesError("Invalid Kryptos instance", {
      code: "invalid_kryptos",
      title: "Invalid Kryptos",
      details: "RSA-OAEP decryption requires an RSA Kryptos key type.",
    });
  }
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey", {
      code: "missing_public_encryption_key",
      title: "Missing Public Encryption Key",
      details:
        "RSA-OAEP decryption requires the RSA-encrypted content encryption key, but it was not provided.",
    });
  }

  if (
    kryptos.algorithm !== "RSA-OAEP" &&
    kryptos.algorithm !== "RSA-OAEP-256" &&
    kryptos.algorithm !== "RSA-OAEP-384" &&
    kryptos.algorithm !== "RSA-OAEP-512"
  ) {
    throw new AesError("Invalid encryption key algorithm", {
      code: "invalid_key_algorithm",
      title: "Invalid Key Algorithm",
      details:
        "RSA decryption requires an RSA-OAEP algorithm variant (RSA-OAEP, RSA-OAEP-256, RSA-OAEP-384, or RSA-OAEP-512).",
      data: { algorithm: kryptos.algorithm },
    });
  }

  const { privateKey } = kryptos.export("pem");

  if (!privateKey) {
    throw new AesError("Unable to decrypt AES without private key", {
      code: "missing_private_key",
      title: "Missing Private Key",
      details:
        "RSA-OAEP decryption requires the RSA private key to unwrap the content encryption key.",
    });
  }

  const contentEncryptionKey = privateDecrypt(
    {
      key: privateKey,
      padding: RSA_PKCS1_OAEP_PADDING,
      oaepHash: calculateRsaOaepHash(kryptos.algorithm),
    },
    publicEncryptionKey,
  );

  return { contentEncryptionKey };
};
