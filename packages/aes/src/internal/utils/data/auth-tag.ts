import type { CipherGCM, DecipherGCM } from "crypto";
import { AesError } from "../../../errors/index.js";
import type { GetAuthTagOptions, SetAuthTagOptions } from "../../types/auth-tag.js";
import { getAesDescriptor } from "../aes-descriptor.js";
import { assertHmacAuthTag, createHmacAuthTag } from "./auth-tag-hmac.js";

export const createAuthTag = ({
  aad,
  encryption,
  cipher,
  content,
  hashKey,
  initialisationVector,
}: GetAuthTagOptions): Buffer => {
  const { mode } = getAesDescriptor(encryption);

  switch (mode) {
    case "cbc-hmac":
      return createHmacAuthTag({
        aad,
        content,
        encryption,
        hashKey,
        initialisationVector,
      });

    // GCM and CCM are AEAD: the cipher produces the tag during finalisation.
    case "gcm":
    case "ccm":
      return (cipher as CipherGCM).getAuthTag();

    default:
      throw new AesError("Unexpected algorithm", {
        code: "unsupported_encryption",
        title: "Unsupported Encryption",
        details:
          "Auth tag creation is only supported for AES-CBC-HMAC, AES-GCM, and AES-CCM variants.",
        data: { encryption },
      });
  }
};

export const assertAuthTag = ({
  aad,
  authTag,
  content,
  hashKey,
  decipher,
  encryption,
  initialisationVector,
}: SetAuthTagOptions): void => {
  if (!authTag) {
    throw new AesError("Auth tag is missing", {
      code: "missing_auth_tag",
      title: "Missing Auth Tag",
      details:
        "Authenticated decryption requires an auth tag to verify ciphertext integrity, but none was provided.",
    });
  }

  const { mode } = getAesDescriptor(encryption);

  switch (mode) {
    case "cbc-hmac":
      assertHmacAuthTag({
        aad,
        authTag,
        content,
        encryption,
        hashKey,
        initialisationVector,
      });
      return;

    // GCM and CCM: hand the tag to the cipher; `decipher.final()` then throws
    // on mismatch. For CCM `setAuthTag` must precede `update` (the caller
    // orders this correctly).
    case "gcm":
    case "ccm":
      (decipher as DecipherGCM).setAuthTag(authTag);
      return;

    default:
      throw new AesError("Unexpected algorithm", {
        code: "unsupported_encryption",
        title: "Unsupported Encryption",
        details:
          "Auth tag verification is only supported for AES-CBC-HMAC, AES-GCM, and AES-CCM variants.",
        data: { encryption },
      });
  }
};
