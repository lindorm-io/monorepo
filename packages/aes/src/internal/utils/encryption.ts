import {
  type CipherCCMOptions,
  type DecipherCCM,
  type DecipherGCM,
  createDecipheriv,
} from "crypto";
import { LATEST_AES_VERSION } from "../constants/version.js";
import { AesError } from "../../errors/AesError.js";
import type { AesContent } from "../../types/content.js";
import type { AesEncryptionRecord } from "../../types/aes-encryption-data.js";
import type {
  PrivateAesDecryptionOptions,
  PrivateAesEncryptionOptions,
} from "../types/aes-data.js";
import { getAesDescriptor } from "./aes-descriptor.js";
import { parseContent } from "./content.js";
import { assertAuthTag } from "./data/auth-tag.js";
import { splitContentEncryptionKey } from "./data/split-content-encryption-key.js";
import { getDecryptionKey } from "./get-key/get-decryption-key.js";
import { getEncryptionKey } from "./get-key/get-encryption-key.js";
import { encryptAesContent } from "./encrypt-content.js";

export const encryptAes = (options: PrivateAesEncryptionOptions): AesEncryptionRecord => {
  const { aad, data, encryption = "A256GCM", kryptos } = options;

  const keyResult = getEncryptionKey({ encryption, kryptos });

  const { authTag, content, contentType, initialisationVector } = encryptAesContent({
    aad,
    contentEncryptionKey: keyResult.contentEncryptionKey,
    data,
    encryption,
  });

  return {
    algorithm: kryptos.algorithm,
    authTag,
    content,
    contentType,
    encryption,
    initialisationVector,
    keyId: kryptos.id,
    pbkdfIterations: keyResult.pbkdfIterations,
    pbkdfSalt: keyResult.pbkdfSalt,
    publicEncryptionIv: keyResult.publicEncryptionIv,
    publicEncryptionJwk: keyResult.publicEncryptionJwk,
    publicEncryptionKey: keyResult.publicEncryptionKey,
    publicEncryptionTag: keyResult.publicEncryptionTag,
    version: LATEST_AES_VERSION,
  };
};

export const decryptAes = <T extends AesContent = string>(
  options: PrivateAesDecryptionOptions,
): T => {
  const {
    aad,
    authTag,
    content,
    contentType,
    encryption,
    initialisationVector,
    kryptos,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  } = options;

  const { contentEncryptionKey } = getDecryptionKey({
    encryption,
    kryptos,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  });

  const { encryptionKey, hashKey } = splitContentEncryptionKey(
    encryption,
    contentEncryptionKey,
  );

  const descriptor = getAesDescriptor(encryption);
  const decipherOptions: CipherCCMOptions | undefined = descriptor.aead
    ? { authTagLength: descriptor.tagBytes }
    : undefined;
  const decipher = createDecipheriv(
    descriptor.nodeCipher,
    encryptionKey,
    initialisationVector,
    decipherOptions as CipherCCMOptions,
  );

  if (descriptor.aead && authTag && authTag.length !== descriptor.tagBytes) {
    throw new AesError("Invalid auth tag length", {
      code: "invalid_auth_tag_length",
      title: "Invalid Auth Tag Length",
      details: `AEAD decryption for ${encryption} requires a ${descriptor.tagBytes}-byte authentication tag.`,
    });
  }

  // For CCM `setAuthTag` must precede `update`; `assertAuthTag` performs it (and
  // CBC-HMAC verifies the HMAC here). It runs before the AAD/update steps below.
  assertAuthTag({
    aad,
    authTag,
    content,
    hashKey,
    decipher,
    encryption,
    initialisationVector,
  });

  // GCM and CCM authenticate the AAD; CCM additionally needs the plaintext
  // length (= ciphertext length for these stream-style ciphers).
  if (descriptor.aead && aad) {
    if (descriptor.mode === "ccm") {
      (decipher as DecipherCCM).setAAD(aad, { plaintextLength: content.length });
    } else {
      (decipher as DecipherGCM).setAAD(aad);
    }
  }

  const final = Buffer.concat([decipher.update(content), decipher.final()]);

  return parseContent<T>(final, contentType);
};
