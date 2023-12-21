import { JwkError } from "../errors";
import { EcJwkValues, JwkValues, PemValues, RsaJwkValues } from "../types";
import { createEcPem } from "./private/ec";
import { createRsaPem } from "./private/rsa";

export const jwkToPem = (jwk: JwkValues): PemValues => {
  const { kty } = jwk;

  switch (kty) {
    case "EC":
      return createEcPem(jwk as EcJwkValues);

    case "RSA":
      return createRsaPem(jwk as RsaJwkValues);

    default:
      throw new JwkError("Invalid KeyType");
  }
};
