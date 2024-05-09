import { _parseMetaStruct } from "./private/parse-meta-struct";
import { _stringifyMetaStruct } from "./private/stringify-meta-struct";

export const JsonKit = {
  stringify: _stringifyMetaStruct,
  parse: _parseMetaStruct,
};
