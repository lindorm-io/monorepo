import { isArray } from "@lindorm/is";
import { Dict } from "@lindorm/types";
import { _parseArrayValues } from "./parse-array-values";
import { _parseObjectValues } from "./parse-object-values";

export const _parseMetaStruct = <T = Dict>(input: any): T => {
  const { json, meta } = JSON.parse(typeof input === "string" ? input : JSON.stringify(input));

  return isArray(json)
    ? (_parseArrayValues(json, meta) as unknown as T)
    : (_parseObjectValues(json, meta) as unknown as T);
};
