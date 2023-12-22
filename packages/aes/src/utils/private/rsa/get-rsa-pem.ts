import { RsaPemValues, isJwk, isPem, jwkToPem } from "@lindorm-io/jwk";
import { AesError } from "../../../errors";
import { AesEncryptionKey } from "../../../types";

export const getRsaPem = (key: AesEncryptionKey): RsaPemValues => {
  if (isPem(key)) {
    if (key.type !== "RSA") {
      throw new AesError("Unexpected PEM type", { debug: { key } });
    }

    return key;
  }

  if (isJwk(key)) {
    const pem = jwkToPem(key);

    if (pem.type !== "RSA") {
      throw new AesError("Unexpected PEM type", { debug: { key: pem } });
    }

    return pem;
  }

  throw new AesError("Unable to get RSA PEM", { debug: { key } });
};
