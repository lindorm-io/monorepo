import { RsaKeySet, WebKeySet } from "@lindorm-io/jwk";
import { RsaError } from "../../errors";
import { CreateRsaSignatureOptions } from "../../types";

type Options = Pick<CreateRsaSignatureOptions, "key" | "keySet">;

export const getKeySet = ({ key, keySet }: Options): RsaKeySet => {
  if (WebKeySet.isRsaKeySet(keySet)) {
    return keySet;
  }

  if (key) {
    const keySet = WebKeySet.createKeySet(key);

    if (!WebKeySet.isRsaKeySet(keySet)) {
      throw new RsaError("Invalid key or key set");
    }

    return keySet;
  }

  throw new RsaError("Invalid key or key set");
};
