import { CipherGCM, DecipherGCM } from "crypto";
import { AesError } from "../../../errors";
import { GetAuthTagOptions, SetAuthTagOptions } from "../../../types/private";
import { _assertHmacAuthTag, _createHmacAuthTag } from "./auth-tag-hmac";

export const _createAuthTag = ({
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
      return _createHmacAuthTag({
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

export const _assertAuthTag = ({
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
      _assertHmacAuthTag({
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
