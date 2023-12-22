import { OctPemValues, isJwk, isPem, jwkToPem } from "@lindorm-io/jwk";
import { AesError } from "../../../errors";
import { AesEncryptionKey } from "../../../types";

export const getOctPem = (key: AesEncryptionKey): OctPemValues => {
  if (isPem(key)) {
    if (key.type !== "oct") {
      throw new AesError("Unexpected PEM type", { debug: { key } });
    }

    return key;
  }

  if (isJwk(key)) {
    const pem = jwkToPem(key);

    if (pem.type !== "oct") {
      throw new AesError("Unexpected PEM type", { debug: { pem } });
    }

    return pem;
  }

  throw new AesError("Unable to get oct PEM", { debug: { key } });
};
