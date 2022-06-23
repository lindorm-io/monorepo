import { KeyPair } from "../../entity";
import { isAfter } from "date-fns";
import { isString } from "lodash";
import { KeyOperation, KeyType } from "../../enum";

export const isKeyAllowed = (key: KeyPair): boolean =>
  !!key.allowed && isAfter(new Date(), key.allowed);

export const isKeyCorrectType =
  (type?: KeyType) =>
  (key: KeyPair): boolean =>
    !type || type === key.type;

export const isKeyExpired = (key: KeyPair): boolean =>
  !!key.expires && isAfter(new Date(), key.expires);

export const isKeyNotExpired = (key: KeyPair): boolean => !isKeyExpired(key);

export const isKeyPrivate = (key: KeyPair): boolean => isString(key.privateKey);

export const isKeySigning = (key: KeyPair): boolean => key.operations.includes(KeyOperation.SIGN);

export const isKeyUsable = (key: KeyPair): boolean => isKeyAllowed(key) && !isKeyExpired(key);
