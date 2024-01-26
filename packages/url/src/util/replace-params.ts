import { ParamsRecord } from "@lindorm-io/common-types";
import { isObject } from "@lindorm-io/core";

type Match = { path: string; param: string };

const findAllMatches = (input: string): Array<Match> => {
  const regex = new RegExp(/(:[a-zA-Z0-9]+)|({[a-zA-Z0-9]+})/g);
  const matches: Array<Match> = [];

  let match: RegExpExecArray | null = null;
  let timeout = 100;

  do {
    match = regex.exec(input);
    timeout -= 1;

    if (!match) continue;

    if (match[1]) {
      matches.push({ path: match[1], param: match[1].replace(":", "") });
    }

    if (match[2]) {
      matches.push({ path: match[2], param: match[2].replace("{", "").replace("}", "") });
    }
  } while (match && timeout > 0);

  return matches;
};

export const replaceParams = <Params = ParamsRecord>(pathname: string, params?: Params): string => {
  if (!isObject(params)) {
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
      result = result.replace(match.path, value);
    }
  }

  return result;
};
