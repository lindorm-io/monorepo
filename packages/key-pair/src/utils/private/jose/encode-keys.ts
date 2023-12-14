import { KeyPairType } from "../../../enums";
import { EncodeKeysOptions, KeyJWK } from "../../../types";
import { encodeEC } from "./ec";
import { encodeRSA } from "./rsa";

export const encodeKeys = ({
  exposePrivateKey = false,
  namedCurve,
  privateKey: _privateKey,
  publicKey: _publicKey,
  type,
}: EncodeKeysOptions): KeyJWK => {
  const privateKey = exposePrivateKey && _privateKey ? _privateKey : undefined;
  const publicKey = _publicKey;
  const crv = namedCurve as string;

  switch (type) {
    case KeyPairType.EC:
      return encodeEC({ crv, privateKey, publicKey });

    case KeyPairType.RSA:
      return encodeRSA({ privateKey, publicKey });

    default:
      throw new Error("Invalid KeyType");
  }
};
