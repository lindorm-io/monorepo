import { isObject } from "@lindorm/is";
import { Dict, Param } from "@lindorm/types";
import { findAllMatches } from "./find-all-matches";

export const replaceParams = <Params extends Dict<Param> = Dict<Param>>(
  pathname: string,
  params?: Params,
): string => {
  if (!params || !isObject(params) || !Object.keys(params).length) {
    return pathname;
  }

  const matches = findAllMatches(pathname);

  if (!matches.length) {
    throw new Error("Pathname contains no param variables");
  }

  if (matches.length !== Object.keys(params).length) {
    throw new Error("Pathname contains more params than provided");
  }

  let result = pathname;

  for (const match of matches) {
    const value = params[match.param];

    if (!value) {
      throw new Error(`Parameter [ ${match.param} ] has no replacement variable`);
    }

    if (Array.isArray(value)) {
      result = result.replace(match.path, value.join(" "));
    } else {
      result = result.replace(match.path, value.toString());
    }
  }

  return result;
};
