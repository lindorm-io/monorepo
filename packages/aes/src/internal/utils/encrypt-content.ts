import { type CipherGCM, type CipherGCMOptions, createCipheriv } from "crypto";
import type {
  EncryptContentOptions,
  EncryptContentResult,
} from "../types/prepared-encryption.js";
import { calculateAesEncryption } from "./calculate/calculate-aes-encryption.js";
import { calculateContentType, contentToBuffer } from "./content.js";
import { createAuthTag } from "./data/auth-tag.js";
import { getInitialisationVector } from "./data/get-initialisation-vector.js";
import { splitContentEncryptionKey } from "./data/split-content-encryption-key.js";

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
