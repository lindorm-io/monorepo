import { isNumber, isNumberString } from "@lindorm/is";
import {
  COSE_KEY,
  COSE_KEY_EC,
  COSE_KEY_OCT,
  COSE_KEY_OKP,
  COSE_KEY_RSA,
  CoseItem,
} from "../../../constants/private";
import { AegisError } from "../../../errors";

export const findCoseByKey = (array: Array<CoseItem>, key: any): CoseItem | undefined => {
  return array.find((i) => i.key === key);
};

export const findCoseByLabel = (
  array: Array<CoseItem>,
  label: any,
): CoseItem | undefined => {
  const integer = isNumber(label)
    ? label
    : isNumberString(label)
      ? parseInt(label, 10)
      : undefined;

  if (!integer) return;

  return array.find((i) => i.label === integer);
};

export const findSpecificCoseKey = (kty: string): Array<CoseItem> => {
  switch (kty) {
    case "EC":
      return [...COSE_KEY, ...COSE_KEY_EC];
    case "OKP":
      return [...COSE_KEY, ...COSE_KEY_OKP];
    case "RSA":
      return [...COSE_KEY, ...COSE_KEY_RSA];
    case "oct":
      return [...COSE_KEY, ...COSE_KEY_OCT];
    default:
      throw new AegisError(`Unsupported COSE key type: ${kty}`);
  }
};
