import { ParamsRecord, QueryRecord } from "@lindorm-io/common-types";
import { Protocol } from "../types";
import { TransformMode, transformCase } from "@lindorm-io/case";
import { destructUrl } from "./destruct-url";
import { isObject } from "@lindorm-io/core";

type Options<Params = ParamsRecord, Query = QueryRecord> = {
  host?: string;
  params?: Params;
  port?: number;
  protocol?: Protocol;
  query?: Query;
  queryCaseTransform?: TransformMode;
};

const replaceParamWithValue = <Params = ParamsRecord>(input: string, params: Params): string => {
  const param = (params as Record<string, any>)[input.replace(":", "")];

  if (!param) {
    throw new Error(`Parameter [ ${input} ] has no replacement variable`);
  }

  if (Array.isArray(param)) {
    return param.join(" ");
  }

  return param.toString();
};

const addParamsToPathname = <Params = ParamsRecord>(pathname: string, params: Params): string => {
  if (!isObject(params)) {
    return pathname;
  }

  const array: Array<string> = [];

  for (const item of pathname.split("/")) {
    if (item.startsWith(":")) {
      array.push(replaceParamWithValue<Params>(item, params));
    } else {
      array.push(item);
    }
  }

  return array.join("/");
};

const addQueryToURL = <Query = QueryRecord>(
  url: URL,
  query: Query,
  queryCaseTransform: TransformMode = "snake",
): URL => {
  if (!isObject(query)) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    const transformed = transformCase(key, queryCaseTransform);

    if (Array.isArray(value)) {
      url.searchParams.append(transformed, value.join(" "));
    } else {
      url.searchParams.append(transformed, value.toString());
    }
  }

  return url;
};

const addToURL = <Params = ParamsRecord, Query = QueryRecord>(
  url: URL,
  options: Options<Params, Query> = {},
): URL => {
  const pathname = addParamsToPathname<Params>(url.pathname, options.params);
  const string = url.toString().replace(url.pathname, pathname);
  return addQueryToURL<Query>(new URL(string), options.query, options.queryCaseTransform);
};

export const createURL = <Params = ParamsRecord, Query = QueryRecord>(
  pathOrUrl: URL | string,
  options: Options<Params, Query> = {},
): URL => {
  if (pathOrUrl instanceof URL) {
    return addToURL<Params, Query>(pathOrUrl, options);
  }

  if (pathOrUrl.startsWith("http")) {
    return addToURL<Params, Query>(new URL(pathOrUrl), options);
  }

  if (!options.host) {
    throw new Error("Invalid URL");
  }

  const destructed = destructUrl(options.host);
  const host = destructed.host;
  const port = destructed.port || options.port;
  const protocol = destructed.protocol || options.protocol || "https";
  const hostAndPort = port ? `${host}:${port}` : host;
  const url = `${protocol}://${hostAndPort}`;

  return addToURL<Params, Query>(new URL(pathOrUrl, url), options);
};
