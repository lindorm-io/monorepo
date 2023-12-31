import { KeySet, OctKeySet, WebKeySet } from "@lindorm-io/jwk";
import { AesError } from "../../errors";
import { EncryptAesDataOptions } from "../../types";

type Options = Pick<EncryptAesDataOptions, "key" | "keySet" | "secret">;

export const getKeySet = ({ key, keySet, secret }: Options): KeySet => {
  if (WebKeySet.isKeySet(keySet)) {
    return keySet;
  }

  if (key) {
    return WebKeySet.createKeySet(key);
  }

  if (Buffer.isBuffer(secret)) {
    return OctKeySet.fromDer({
      privateKey: secret,
      type: "oct",
    });
  }

  if (typeof secret === "string") {
    return OctKeySet.fromPem({
      privateKey: secret,
      type: "oct",
    });
  }

  throw new AesError("Unable to set key");
};
