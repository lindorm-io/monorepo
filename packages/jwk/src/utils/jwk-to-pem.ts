import { JwkError } from "../errors";
import { EcdhJwk, JWK, PemData, RsaJwk } from "../types";
import { decodeEC } from "./private/ec";
import { decodeRSA } from "./private/rsa";

export const jwkToPem = (jwk: JWK): PemData => {
  switch (jwk.kty) {
    case "EC":
      return decodeEC(jwk as EcdhJwk);

    case "RSA":
      return decodeRSA(jwk as RsaJwk);

    default:
      throw new JwkError("Invalid KeyType");
  }
};
