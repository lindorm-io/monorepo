import {
  type CipherCCM,
  type CipherCCMOptions,
  type CipherGCM,
  createCipheriv,
} from "crypto";
import type {
  EncryptContentOptions,
  EncryptContentResult,
} from "../types/prepared-encryption.js";
import { getAesDescriptor } from "./aes-descriptor.js";
import { calculateContentType, contentToBuffer } from "./content.js";
import { createAuthTag } from "./data/auth-tag.js";
import { getInitialisationVector } from "./data/get-initialisation-vector.js";
import { splitContentEncryptionKey } from "./data/split-content-encryption-key.js";

export const encryptAesContent = (
  options: EncryptContentOptions,
): EncryptContentResult => {
  const { aad, contentEncryptionKey, data, encryption } = options;

  const descriptor = getAesDescriptor(encryption);
  const { encryptionKey, hashKey } = splitContentEncryptionKey(
    encryption,
    contentEncryptionKey,
  );
  const initialisationVector =
    options.initialisationVector ?? getInitialisationVector(encryption);

  const cipherOptions: CipherCCMOptions | undefined = descriptor.aead
    ? { authTagLength: descriptor.tagBytes }
    : undefined;
  const cipher = createCipheriv(
    descriptor.nodeCipher,
    encryptionKey,
    initialisationVector,
    cipherOptions as CipherCCMOptions,
  );

  const contentType = calculateContentType(data);
  const buffer = contentToBuffer(data, contentType);

  // GCM and CCM both authenticate the AAD; CCM additionally requires the
  // plaintext length up front, and `setAAD` must precede `update`.
  if (descriptor.aead && aad) {
    if (descriptor.mode === "ccm") {
      (cipher as CipherCCM).setAAD(aad, { plaintextLength: buffer.length });
    } else {
      (cipher as CipherGCM).setAAD(aad);
    }
  }

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
