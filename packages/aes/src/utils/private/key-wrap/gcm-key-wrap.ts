import {
  CipherGCM,
  DecipherGCM,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "crypto";
import { AesError } from "../../../errors";
import {
  KeyUnwrapOptions,
  KeyUnwrapResult,
  KeyWrapOptions,
  KeyWrapResult,
} from "../../../types/private";
import { _calculateKeyWrapEncryption } from "../calculate/calculate-key-wrap-encryption";

export const _gcmKeyWrap = ({
  contentEncryptionKey,
  keyEncryptionKey,
  kryptos,
}: KeyWrapOptions): KeyWrapResult => {
  const algorithm = _calculateKeyWrapEncryption(kryptos);

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

export const _gcmKeyUnwrap = ({
  keyEncryptionKey,
  kryptos,
  publicEncryptionIv,
  publicEncryptionKey,
  publicEncryptionTag,
}: KeyUnwrapOptions): KeyUnwrapResult => {
  if (!publicEncryptionIv) {
    throw new AesError("Invalid public encryption iv");
  }
  if (!publicEncryptionTag) {
    throw new AesError("Invalid public encryption tag");
  }

  const algorithm = _calculateKeyWrapEncryption(kryptos);

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
