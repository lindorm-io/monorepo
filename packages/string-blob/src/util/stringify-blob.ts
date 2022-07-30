import { getMetaObject } from "./get-meta-object";
import { stringifyObjectValues } from "./stringify-object-values";

export const stringifyBlob = <T = Record<string, any>>(object: T): string => {
  return JSON.stringify({
    json: stringifyObjectValues(object),
    meta: getMetaObject(object),
  });
};
