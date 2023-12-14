import { KeyPairType } from "../../../enum";
import { EllipticalJWK, JWK, JoseData, RivestJWK } from "../../../types";
import { decodeEC } from "./ec";
import { decodeRSA } from "./rsa";

export const decodeKeys = (jwk: JWK): JoseData => {
  switch (jwk.kty) {
    case KeyPairType.EC:
      return decodeEC(jwk as EllipticalJWK);

    case KeyPairType.RSA:
      return decodeRSA(jwk as RivestJWK);

    default:
      throw new Error("Invalid KeyType");
  }
};
