import { KryptosKit } from "@lindorm/kryptos";
import { randomBytes } from "crypto";
import { AesError } from "../../../errors/index.js";
import type {
  CreateCekOptions,
  CreateCekResult,
  DecryptCekOptions,
  DecryptCekResult,
} from "../../types/content-encryption-key.js";
import { calculateContentEncryptionKeySize } from "../calculate/calculate-content-encryption-key-size.js";
import { calculateKeyWrapSize } from "../calculate/calculate-key-wrap-size.js";
import { keyUnwrap, keyWrap } from "../key-wrap/key-wrap.js";

export const getOctKeyWrapEncryptionKey = ({
  encryption,
  kryptos,
}: CreateCekOptions): CreateCekResult => {
  if (!KryptosKit.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", {
      code: "invalid_kryptos",
      title: "Invalid Kryptos",
      details: "AES key-wrap encryption requires an oct (symmetric) Kryptos key type.",
      debug: { kryptos: kryptos.toJSON() },
    });
  }

  const der = kryptos.export("der");

  const cekSize = calculateContentEncryptionKeySize(encryption);
  const contentEncryptionKey = randomBytes(cekSize);

  const keyWrapSize = calculateKeyWrapSize(kryptos.algorithm);
  const keyEncryptionKey = der.privateKey.subarray(0, keyWrapSize);

  const { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag } = keyWrap({
    contentEncryptionKey,
    kryptos,
    keyEncryptionKey,
  });

  return {
    contentEncryptionKey,
    publicEncryptionKey,
    publicEncryptionIv,
    publicEncryptionTag,
  };
};

export const getOctKeyWrapDecryptionKey = ({
  kryptos,
  publicEncryptionIv,
  publicEncryptionKey,
  publicEncryptionTag,
}: DecryptCekOptions): DecryptCekResult => {
  if (!KryptosKit.isOct(kryptos)) {
    throw new AesError("Invalid Kryptos", {
      code: "invalid_kryptos",
      title: "Invalid Kryptos",
      details: "AES key-wrap decryption requires an oct (symmetric) Kryptos key type.",
      debug: { kryptos: kryptos.toJSON() },
    });
  }
  if (!publicEncryptionKey) {
    throw new AesError("Missing publicEncryptionKey", {
      code: "missing_public_encryption_key",
      title: "Missing Public Encryption Key",
      details:
        "AES key-wrap decryption requires the wrapped content encryption key, but it was not provided.",
    });
  }

  const der = kryptos.export("der");

  const keyWrapSize = calculateKeyWrapSize(kryptos.algorithm);
  const keyEncryptionKey = der.privateKey.subarray(0, keyWrapSize);

  return keyUnwrap({
    keyEncryptionKey,
    kryptos,
    publicEncryptionIv,
    publicEncryptionKey,
    publicEncryptionTag,
  });
};
