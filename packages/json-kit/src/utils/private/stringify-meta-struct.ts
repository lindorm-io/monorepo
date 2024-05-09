import { isArray, isObjectLike } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _getMetaArray } from "./get-meta-array";
import { _getMetaObject } from "./get-meta-object";
import { _stringifyArrayValues } from "./stringify-array-values";
import { _stringifyObjectValues } from "./stringify-object-values";

export const _stringifyMetaStruct = <T extends Array<any> | Dict = Dict>(input: T): string => {
  if (isArray(input)) {
    return JSON.stringify({ json: _stringifyArrayValues(input), meta: _getMetaArray(input) });
  }
  if (isObjectLike(input)) {
    return JSON.stringify({ json: _stringifyObjectValues(input), meta: _getMetaObject(input) });
  }

  throw new TypeError("Expected input to be an array or object");
};
