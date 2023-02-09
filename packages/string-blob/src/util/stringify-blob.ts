import { getMetaArray } from "./get-meta-array";
import { getMetaObject } from "./get-meta-object";
import { isObjectLike } from "@lindorm-io/core";
import { stringifyArrayValues } from "./stringify-array-values";
import { stringifyObjectValues } from "./stringify-object-values";

export const stringifyBlob = <T = Record<string, any>>(input: T): string => {
  if (Array.isArray(input)) {
    return JSON.stringify({ json: stringifyArrayValues(input), meta: getMetaArray(input) });
  }

  if (isObjectLike(input)) {
    return JSON.stringify({ json: stringifyObjectValues(input), meta: getMetaObject(input) });
  }

  throw new Error(`Invalid input type [ ${typeof input} ]`);
};
