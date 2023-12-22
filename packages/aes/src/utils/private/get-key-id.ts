import { isJwk, isPem } from "@lindorm-io/jwk";
import { AesError } from "../../errors";
import { AesEncryptionKey } from "../../types";

export const getKeyId = (key?: AesEncryptionKey): string | undefined => {
  if (!key) {
    return undefined;
  }

  if (isPem(key)) {
    return key.id;
  }

  if (isJwk(key)) {
    return key.kid;
  }

  throw new AesError("Unexpected key type", { debug: { key } });
};
