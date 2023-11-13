import { TransformMode, transformCase } from "@lindorm-io/case";
import { ParamsRecord, QueryRecord } from "@lindorm-io/common-types";
import { isObject } from "@lindorm-io/core";
import { createBaseUrl } from "./create-base-url";
import { extractSearchParams } from "./extract-search-params";

type Options<Params = ParamsRecord, Query = QueryRecord> = {
  baseURL?: string;
  host?: string;
  params?: Params;
  port?: number;
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

const addParamsToPathname = <Params = ParamsRecord>(pathname: string, params?: Params): string => {
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
  query?: Query,
  queryCaseTransform?: TransformMode,
): URL => {
  if (!isObject(query)) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    const transformed = queryCaseTransform ? transformCase<string>(key, queryCaseTransform) : key;

    if (Array.isArray(value)) {
      url.searchParams.append(transformed, value.join(" "));
    } else if (value) {
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

  const baseURL = options.host || options.baseURL;

  if (!baseURL) {
    throw new Error(`Invalid base [ ${baseURL} ]`);
  }

  const url = createBaseUrl({
    base: options.baseURL,
    host: options.host,
    port: options.port,
  });

  const pathname = url.pathname.length ? `${url.pathname}${pathOrUrl}` : pathOrUrl;
  const path = pathname.replace(/\/\//, "/");

  const searchParams = extractSearchParams<Query>(url);

  return addToURL<Params, Query>(new URL(path, url), {
    ...options,
    query: { ...searchParams, ...(options.query || {}) },
  });
};
