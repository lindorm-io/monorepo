import type { CipherGCM, DecipherGCM } from "crypto";
import { AesError } from "../../../errors/index.js";
import type { GetAuthTagOptions, SetAuthTagOptions } from "../../types/auth-tag.js";
import { assertHmacAuthTag, createHmacAuthTag } from "./auth-tag-hmac.js";

export const createAuthTag = ({
  aad,
  encryption,
  cipher,
  content,
  hashKey,
  initialisationVector,
}: GetAuthTagOptions): Buffer => {
  switch (encryption) {
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      return createHmacAuthTag({
        aad,
        content,
        encryption,
        hashKey,
        initialisationVector,
      });

    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      return (cipher as CipherGCM).getAuthTag();

    default:
      throw new AesError("Unexpected algorithm");
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
    throw new AesError("Auth tag is missing");
  }

  switch (encryption) {
    case "A128CBC-HS256":
    case "A192CBC-HS384":
    case "A256CBC-HS512":
      assertHmacAuthTag({
        aad,
        authTag,
        content,
        encryption,
        hashKey,
        initialisationVector,
      });
      return;

    case "A128GCM":
    case "A192GCM":
    case "A256GCM":
      (decipher as DecipherGCM).setAuthTag(authTag);
      return;

    default:
      throw new AesError("Unexpected algorithm");
  }
};
