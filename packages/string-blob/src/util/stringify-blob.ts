import { getMetaArray } from "./get-meta-array";
import { getMetaObject } from "./get-meta-object";
import { stringifyArrayValues } from "./stringify-array-values";
import { stringifyObjectValues } from "./stringify-object-values";

export const stringifyBlob = <T = Record<string, any>>(input: T): string => {
  return JSON.stringify({
    json: Array.isArray(input) ? stringifyArrayValues(input) : stringifyObjectValues(input),
    meta: Array.isArray(input) ? getMetaArray(input) : getMetaObject(input),
  });
};
