import {
  CipherGCM,
  CipherGCMOptions,
  DecipherGCM,
  createCipheriv,
  createDecipheriv,
} from "crypto";
import { LATEST_AES_VERSION } from "../../constants/private";
import { AesError } from "../../errors";
import { AesContent, AesEncryptionRecord } from "../../types";
import {
  PrivateAesDecryptionOptions,
  PrivateAesEncryptionOptions,
} from "../../types/private";
import { calculateAesEncryption } from "./calculate";
import { calculateContentType, contentToBuffer, parseContent } from "./content";
import {
  assertAuthTag,
  createAuthTag,
  getInitialisationVector,
  splitContentEncryptionKey,
} from "./data";
import { getDecryptionKey, getEncryptionKey } from "./get-key";

export const encryptAes = (options: PrivateAesEncryptionOptions): AesEncryptionRecord => {
  const { aad, data, encryption = "A256GCM", kryptos } = options;

  const {
    contentEncryptionKey,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
  } = getEncryptionKey({
    encryption,
    kryptos,
  });

  const { encryptionKey, hashKey } = splitContentEncryptionKey(
    encryption,
    contentEncryptionKey,
  );

  const aesEncryption = calculateAesEncryption(encryption);
  const initialisationVector = getInitialisationVector(encryption);
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

  return {
    algorithm: kryptos.algorithm,
    authTag,
    content,
    contentType,
    encryption,
    initialisationVector,
    keyId: kryptos.id,
    pbkdfIterations,
    pbkdfSalt,
    publicEncryptionIv,
    publicEncryptionJwk,
    publicEncryptionKey,
    publicEncryptionTag,
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

  const aesEncryption = calculateAesEncryption(encryption);
  const isGcm = encryption.includes("GCM");
  const decipherOptions: CipherGCMOptions | undefined = isGcm
    ? { authTagLength: 16 }
    : undefined;
  const decipher = createDecipheriv(
    aesEncryption,
    encryptionKey,
    initialisationVector,
    decipherOptions as CipherGCMOptions,
  );

  if (isGcm && authTag && authTag.length !== 16) {
    throw new AesError("Invalid GCM auth tag length");
  }

  if (isGcm && aad) {
    (decipher as DecipherGCM).setAAD(aad);
  }

  assertAuthTag({
    aad,
    authTag,
    content,
    hashKey,
    decipher,
    encryption,
    initialisationVector,
  });

  const final = Buffer.concat([decipher.update(content), decipher.final()]);

  return parseContent<T>(final, contentType);
};
