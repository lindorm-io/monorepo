import { RsaPemValues } from "@lindorm-io/jwk";
import { RsaPrivateKey } from "crypto";
import { AesError } from "../../../errors";

export const getRsaKeyObject = (pem: Omit<RsaPemValues, "type">): RsaPrivateKey => {
  if (pem.privateKey) {
    return { key: pem.privateKey, ...(pem.passphrase ? { passphrase: pem.passphrase } : {}) };
  }

  if (pem.publicKey) {
    return { key: pem.publicKey };
  }

  throw new AesError("Unable to create RSA key object", { debug: { pem } });
};
