import { JwkError } from "../errors";
import { JwkValues, PemValues } from "../types";
import { createOctPem } from "./private";
import { createEcPem } from "./private/ec";
import { createRsaPem } from "./private/rsa";

export const jwkToPem = (jwk: JwkValues): PemValues => {
  const { kty } = jwk;

  switch (kty) {
    case "EC":
      return createEcPem(jwk);

    case "RSA":
      return createRsaPem(jwk);

    case "oct":
      return createOctPem(jwk);

    default:
      throw new JwkError("Invalid KeyType");
  }
};
