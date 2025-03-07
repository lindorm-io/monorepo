import { isArray, isBooleanString, isDateString, isNumberString } from "@lindorm/is";
import { Dict } from "@lindorm/types";

const parseValue = (value: string | undefined): any => {
  if (!value) return value;

  const decoded = decodeURIComponent(value);

  if (isBooleanString(value)) {
    return decoded.toLowerCase() === "true";
  }

  if (isDateString(value)) {
    return new Date(decoded);
  }

  if (isNumberString(value)) {
    return parseInt(decoded, 10);
  }

  if (decoded === "null") {
    return null;
  }

  if (decoded === "undefined") {
    return undefined;
  }

  if (decoded.startsWith("[") && decoded.endsWith("]")) {
    return JSON.parse(decoded);
  }

  if (decoded.startsWith("{") && decoded.endsWith("}")) {
    return JSON.parse(decoded);
  }

  return decoded;
};

export const parseStringRecord = <T = any>(
  record: Dict<string | undefined | Array<string | undefined>>,
): Dict<T> => {
  const result: Dict<any> = {};

  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      result[key] = undefined;
      continue;
    }

    if (isArray(value)) {
      result[key] = value.map(parseValue);
      continue;
    }

    result[key] = parseValue(value);
  }

  return result;
};
