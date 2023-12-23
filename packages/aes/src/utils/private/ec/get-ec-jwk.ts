import { EcJwkValues, isJwk, isPem, pemToJwk } from "@lindorm-io/jwk";
import { AesError } from "../../../errors";
import { AesEncryptionKey } from "../../../types";

export const getEcJwk = (key: AesEncryptionKey): EcJwkValues => {
  if (isJwk(key)) {
    if (key.kty !== "EC") {
      throw new AesError("Unexpected JWK type", { debug: { key } });
    }

    return key;
  }

  if (isPem(key)) {
    const jwk = pemToJwk(key);

    if (jwk.kty !== "EC") {
      throw new AesError("Unexpected PEM type", { debug: { jwk } });
    }

    return jwk;
  }

  throw new AesError("Unable to get EC PEM", { debug: { key } });
};
