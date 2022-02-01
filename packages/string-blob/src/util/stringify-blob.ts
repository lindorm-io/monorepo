import { getMetaObject } from "./get-meta-object";
import { stringifyObjectValues } from "./stringify-object-values";

export const stringifyBlob = (object: Record<string, any>): string => {
  return JSON.stringify({
    json: stringifyObjectValues(object),
    meta: getMetaObject(object),
  });
};
