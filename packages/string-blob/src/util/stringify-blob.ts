import { getMetaArray } from "./get-meta-array";
import { getMetaObject } from "./get-meta-object";
import { isArray } from "lodash";
import { stringifyArrayValues } from "./stringify-array-values";
import { stringifyObjectValues } from "./stringify-object-values";

export const stringifyBlob = <T = Record<string, any>>(input: T): string => {
  return JSON.stringify({
    json: isArray(input) ? stringifyArrayValues(input) : stringifyObjectValues(input),
    meta: isArray(input) ? getMetaArray(input) : getMetaObject(input),
  });
};
