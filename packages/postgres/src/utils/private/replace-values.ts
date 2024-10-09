import { isArray, isObject } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import { QueryConfigValues } from "pg";

export const replaceValues = <V>(
  values: QueryConfigValues<V>,
  stringifyComplexTypes: boolean,
): QueryConfigValues<V> => {
  if (!values.length) return values;
  if (!stringifyComplexTypes) return values;

  const array: Array<any> = [];

  for (const value of values) {
    if (isObject(value) || (isArray(value) && value.some(isObject))) {
      array.push(JsonKit.stringify(value));
    } else if (isArray(value)) {
      array.push(JSON.stringify(value));
    } else {
      array.push(value);
    }
  }

  return array as QueryConfigValues<V>;
};
