import {
  type CipherGCM,
  type DecipherGCM,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import { AesError } from "../../../errors/index.js";
import type {
  KeyUnwrapOptions,
  KeyUnwrapResult,
  KeyWrapOptions,
  KeyWrapResult,
} from "../../types/key-wrap.js";
import { calculateKeyWrapEncryption } from "../calculate/calculate-key-wrap-encryption.js";

export const gcmKeyWrap = ({
  contentEncryptionKey,
  keyEncryptionKey,
  kryptos,
}: KeyWrapOptions): KeyWrapResult => {
  const algorithm = calculateKeyWrapEncryption(kryptos);

  const publicEncryptionIv = randomBytes(12);
  const cipher = createCipheriv(
    algorithm,
    keyEncryptionKey,
    publicEncryptionIv,
  ) as CipherGCM;

  const publicEncryptionKey = Buffer.concat([
    cipher.update(contentEncryptionKey),
    cipher.final(),
  ]);

  const publicEncryptionTag = cipher.getAuthTag();

  return { publicEncryptionKey, publicEncryptionIv, publicEncryptionTag };
};

export const gcmKeyUnwrap = ({
  keyEncryptionKey,
  kryptos,
  publicEncryptionIv,
  publicEncryptionKey,
  publicEncryptionTag,
}: KeyUnwrapOptions): KeyUnwrapResult => {
  if (!publicEncryptionIv) {
    throw new AesError("Invalid public encryption iv", {
      code: "missing_key_wrap_iv",
      title: "Missing Key Wrap IV",
      details:
        "GCM key unwrapping requires a public encryption IV, but none was supplied with the wrapped key.",
    });
  }
  if (!publicEncryptionTag) {
    throw new AesError("Invalid public encryption tag", {
      code: "missing_key_wrap_tag",
      title: "Missing Key Wrap Tag",
      details:
        "GCM key unwrapping requires a public encryption auth tag, but none was supplied with the wrapped key.",
    });
  }
  if (publicEncryptionIv.length !== 12) {
    throw new AesError("Invalid GCM key wrap IV length", {
      code: "invalid_key_wrap_iv_length",
      title: "Invalid Key Wrap IV Length",
      details: "GCM key unwrapping requires a 12-byte (96-bit) public encryption IV.",
    });
  }
  if (publicEncryptionTag.length !== 16) {
    throw new AesError("Invalid GCM key wrap auth tag length", {
      code: "invalid_key_wrap_tag_length",
      title: "Invalid Key Wrap Tag Length",
      details:
        "GCM key unwrapping requires a 16-byte (128-bit) public encryption auth tag.",
    });
  }

  const algorithm = calculateKeyWrapEncryption(kryptos);

  const decipher = createDecipheriv(
    algorithm,
    keyEncryptionKey,
    publicEncryptionIv,
  ) as DecipherGCM;

  decipher.setAuthTag(publicEncryptionTag);

  const contentEncryptionKey = Buffer.concat([
    decipher.update(publicEncryptionKey),
    decipher.final(),
  ]);

  return { contentEncryptionKey };
};
