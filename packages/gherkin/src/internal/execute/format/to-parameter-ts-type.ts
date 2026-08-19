/**
 * Maps a generated expression parameter's `ParameterInfo.type` — the NAME of
 * the ParameterType's constructor (`String` for {string}/{word}/{bigdecimal},
 * `Number` for {int}/{float}, `BigInt` for {biginteger}) — to the TypeScript
 * type an undefined-step snippet annotates. `null` (custom parameter types
 * declare no constructor) and unrecognised names render `unknown`.
 */
export const toParameterTsType = (type: string | null): string => {
  switch (type) {
    case "String":
      return "string";

    case "Number":
      return "number";

    case "BigInt":
      return "bigint";

    default:
      return "unknown";
  }
};
