import { RsaKeySet, WebKeySet } from "@lindorm-io/jwk";
import { RsaError } from "../../errors";
import { CreateRsaSignatureOptions } from "../../types";

type Options = Pick<CreateRsaSignatureOptions, "key" | "keySet">;

export const getKeySet = ({ key, keySet }: Options): RsaKeySet => {
  if (keySet && WebKeySet.isRsaKeySet(keySet)) {
    return keySet;
  }

  if (WebKeySet.isDer(key) && WebKeySet.isRsaDer(key)) {
    return RsaKeySet.fromDer(key);
  }

  if (WebKeySet.isJwk(key) && WebKeySet.isRsaJwk(key)) {
    return RsaKeySet.fromJwk(key);
  }

  if (WebKeySet.isPem(key) && WebKeySet.isRsaPem(key)) {
    return RsaKeySet.fromPem(key);
  }

  throw new RsaError("Invalid key or key set");
};
