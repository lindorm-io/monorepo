import { CipherGCM, DecipherGCM } from "crypto";
import { AesError } from "../../../errors";
import { GetAuthTagOptions, SetAuthTagOptions } from "../../../types/auth-tag";
import { createHmacAuthTag, verifyHmacAuthTag } from "./auth-tag-hmac";

export const _getAuthTag = ({
  encryption,
  cipher,
  content,
  contentEncryptionKey,
  initialisationVector,
  integrityHash,
}: GetAuthTagOptions): Buffer | undefined => {
  switch (encryption) {
    case "aes-128-cbc":
    case "aes-192-cbc":
    case "aes-256-cbc":
      if (!integrityHash) {
        return;
      }
      return createHmacAuthTag({
        content,
        contentEncryptionKey,
        initialisationVector,
        integrityHash,
      });

    case "aes-128-gcm":
    case "aes-192-gcm":
    case "aes-256-gcm":
      return (cipher as CipherGCM).getAuthTag();

    default:
      throw new AesError("Unexpected algorithm");
  }
};

export const _setAuthTag = ({
  authTag,
  content,
  contentEncryptionKey,
  decipher,
  encryption,
  initialisationVector,
  integrityHash,
}: SetAuthTagOptions): void => {
  switch (encryption) {
    case "aes-128-cbc":
    case "aes-192-cbc":
    case "aes-256-cbc":
      if (!authTag || !integrityHash) {
        return;
      }
      verifyHmacAuthTag({
        authTag,
        content,
        contentEncryptionKey,
        initialisationVector,
        integrityHash,
      });
      return;

    case "aes-128-gcm":
    case "aes-192-gcm":
    case "aes-256-gcm":
      if (!authTag) {
        throw new AesError("Auth tag is required for GCM decryption");
      }
      (decipher as DecipherGCM).setAuthTag(authTag);
      return;

    default:
      throw new AesError("Unexpected algorithm");
  }
};
