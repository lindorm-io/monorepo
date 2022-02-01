import { isArrayStrict, isObjectStrict } from "./strict-type";
import { snakeCase, startsWith } from "lodash";

type Default = Record<string, string | number | boolean | Array<string | number | boolean>>;

interface Options<Params, Query> {
  baseUrl?: string;
  params?: Params;
  query?: Query;
}

const replaceParamWithValue = <Params extends Default = Default>(
  string: string,
  params: Params,
): string => {
  const param = params[string.replace(":", "")];

  if (!param) {
    throw new Error(`Parameter [ ${string} ] has no replacement variable`);
  }

  if (isArrayStrict(param)) {
    return param.join(" ");
  }

  return param.toString();
};

const addParamsToPathname = <Params extends Default = Default>(
  pathname: string,
  params?: Params,
): string => {
  if (!isObjectStrict(params)) {
    return pathname;
  }

  const array: Array<string> = [];

  for (const item of pathname.split("/")) {
    if (startsWith(item, ":")) {
      array.push(replaceParamWithValue<Params>(item, params));
    } else {
      array.push(item);
    }
  }

  return array.join("/");
};

const addQueryToURL = <Query extends Default = Default>(url: URL, query?: Query): URL => {
  if (!isObjectStrict(query)) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    if (isArrayStrict(value)) {
      url.searchParams.append(snakeCase(key), value.join(" "));
    } else {
      url.searchParams.append(snakeCase(key), value.toString());
    }
  }

  return url;
};

export const createURL = <Params extends Default = Default, Query extends Default = Default>(
  path: string | URL,
  options: Options<Params, Query> = {},
): URL => {
  const { baseUrl, params, query } = options;

  if (path instanceof URL && baseUrl) {
    throw new Error("Options [ baseUrl ] cannot be used when path is URL");
  }

  const original = path instanceof URL ? path : new URL(path, baseUrl);
  const pathname = addParamsToPathname<Params>(original.pathname, params);
  const string = original.toString().replace(original.pathname, pathname);

  return addQueryToURL<Query>(new URL(string), query);
};
