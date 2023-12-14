import { isAfter } from "date-fns";
import { KeyPair } from "../../entity";
import { KeyPairOperation, KeyPairType } from "../../enum";

export const isKeyAllowed = (key: KeyPair): boolean =>
  !!key.notBefore && isAfter(new Date(), key.notBefore);

export const isKeyCorrectType =
  (type?: KeyPairType) =>
  (key: KeyPair): boolean =>
    !type || type === key.type;

export const isKeyExpired = (key: KeyPair): boolean =>
  !!key.expiresAt && isAfter(new Date(), key.expiresAt);

export const isKeyNotExpired = (key: KeyPair): boolean => !isKeyExpired(key);

export const isKeyJwkCompatible = (key: KeyPair): boolean =>
  [KeyPairType.EC, KeyPairType.RSA].includes(key.type);

export const isKeyPublic = (key: KeyPair): boolean => typeof key.publicKey === "string";

export const isKeyPrivate = (key: KeyPair): boolean => typeof key.privateKey === "string";

export const isKeySigning = (key: KeyPair): boolean =>
  key.operations.includes(KeyPairOperation.SIGN);

export const isKeyUsable = (key: KeyPair): boolean => isKeyAllowed(key) && !isKeyExpired(key);
