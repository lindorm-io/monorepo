import { JoseData, JWK, EllipticalJWK, RivestJWK } from "../../../types";
import { KeyType } from "../../../enum";
import { decodeEC } from "./ec";
import { decodeRSA } from "./rsa";

export const decodeKeys = (jwk: JWK): JoseData => {
  switch (jwk.kty) {
    case KeyType.EC:
      return decodeEC(jwk as EllipticalJWK);

    case KeyType.RSA:
      return decodeRSA(jwk as RivestJWK);

    default:
      throw new Error("Invalid KeyType");
  }
};
