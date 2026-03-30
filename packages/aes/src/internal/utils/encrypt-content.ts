import { CipherGCM, CipherGCMOptions, createCipheriv } from "crypto";
import {
  EncryptContentOptions,
  EncryptContentResult,
} from "#internal/types/prepared-encryption";
import { calculateAesEncryption } from "#internal/utils/calculate/calculate-aes-encryption";
import { calculateContentType, contentToBuffer } from "#internal/utils/content";
import { createAuthTag } from "#internal/utils/data/auth-tag";
import { getInitialisationVector } from "#internal/utils/data/get-initialisation-vector";
import { splitContentEncryptionKey } from "#internal/utils/data/split-content-encryption-key";

export const encryptAesContent = (
  options: EncryptContentOptions,
): EncryptContentResult => {
  const { aad, contentEncryptionKey, data, encryption } = options;

  const { encryptionKey, hashKey } = splitContentEncryptionKey(
    encryption,
    contentEncryptionKey,
  );
  const aesEncryption = calculateAesEncryption(encryption);
  const initialisationVector =
    options.initialisationVector ?? getInitialisationVector(encryption);
  const isGcm = encryption.includes("GCM");
  const cipherOptions: CipherGCMOptions | undefined = isGcm
    ? { authTagLength: 16 }
    : undefined;
  const cipher = createCipheriv(
    aesEncryption,
    encryptionKey,
    initialisationVector,
    cipherOptions as CipherGCMOptions,
  );

  if (isGcm && aad) {
    (cipher as CipherGCM).setAAD(aad);
  }

  const contentType = calculateContentType(data);
  const buffer = contentToBuffer(data, contentType);
  const content = Buffer.concat([cipher.update(buffer), cipher.final()]);

  const authTag = createAuthTag({
    aad,
    cipher,
    content,
    hashKey,
    encryption,
    initialisationVector,
  });

  return { authTag, content, contentType, initialisationVector };
};
