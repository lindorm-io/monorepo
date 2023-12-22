import { JwkType, isJwk, isPem } from "@lindorm-io/jwk";
import { AesError } from "../../errors";
import { AesEncryptionKey } from "../../types";

export const getKeyType = (key: AesEncryptionKey): JwkType => {
  if (isPem(key)) {
    return key.type;
  }

  if (isJwk(key)) {
    return key.kty;
  }

  throw new AesError("Unexpected key type", { debug: { key } });
};
