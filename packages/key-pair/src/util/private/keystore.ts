import { KeyPair } from "../../entity";
import { isAfter } from "date-fns";
import { isString } from "lodash";

export const isKeyAllowed = (key: KeyPair): boolean => {
  return isAfter(new Date(), key.allowed);
};

export const isKeyExpired = (key: KeyPair): boolean => {
  if (key.expires === null) return false;

  return isAfter(new Date(), key.expires);
};

export const isKeyPrivate = (key: KeyPair): boolean => {
  return isString(key.privateKey);
};

export const isKeyUsable = (key: KeyPair): boolean => {
  return isKeyAllowed(key) && !isKeyExpired(key);
};
