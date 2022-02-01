import { getMetaArray } from "./get-meta-array";
import { getMetaType } from "./get-meta-type";
import { isArrayStrict, isObjectStrict } from "@lindorm-io/core";

export const getMetaObject = (input: Record<string, any>): Record<string, string> => {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isObjectStrict(value)) {
      result[key] = getMetaObject(value);
    } else if (isArrayStrict(value)) {
      result[key] = getMetaArray(value);
    } else {
      result[key] = getMetaType(value);
    }
  }

  return result;
};
