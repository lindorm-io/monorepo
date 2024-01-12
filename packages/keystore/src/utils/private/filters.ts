import { KeySetType, KeySetUsage, WebKeySet } from "@lindorm-io/jwk";
import { isAfter } from "date-fns";

const isKeySetExpired = (keySet: WebKeySet): boolean =>
  !!keySet.expiresAt && isAfter(new Date(), keySet.expiresAt);

export const isKeySetActive = (keySet: WebKeySet): boolean => isAfter(new Date(), keySet.notBefore);

export const isKeySetCorrectType =
  (type?: KeySetType) =>
  (keySet: WebKeySet): boolean =>
    !type || type === keySet.type;

export const isKeySetCorrectUsage =
  (usage?: KeySetUsage) =>
  (keySet: WebKeySet): boolean =>
    !usage || usage === keySet.use;

export const isKeySetExternal =
  (external: boolean = true) =>
  (keySet: WebKeySet): boolean =>
    keySet.isExternal === external;

export const isKeySetNotExpired = (keySet: WebKeySet): boolean => !isKeySetExpired(keySet);

export const isKeySetPrivate = (keySet: WebKeySet): boolean => keySet.hasPrivateKey;

export const isKeySetPublic = (keySet: WebKeySet): boolean => keySet.hasPublicKey;
