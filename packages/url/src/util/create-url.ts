import { ParamsRecord, Protocol, QueryRecord } from "../types";
import { TransformMode, transformCase } from "@lindorm-io/case";
import { destructUrl } from "./destruct-url";
import { isArray } from "lodash";
import { isObjectStrict } from "./is-object-strict";

type Options = {
  host?: string;
  params?: ParamsRecord;
  port?: number;
  protocol?: Protocol;
  query?: QueryRecord;
  queryCaseTransform?: TransformMode;
};

const replaceParamWithValue = (input: string, params: ParamsRecord): string => {
  const param = params[input.replace(":", "")];

  if (!param) {
    throw new Error(`Parameter [ ${input} ] has no replacement variable`);
  }

  if (isArray(param)) {
    return param.join(" ");
  }

  return param.toString();
};

const addParamsToPathname = (pathname: string, params: ParamsRecord): string => {
  if (!isObjectStrict(params)) {
    return pathname;
  }

  const array: Array<string> = [];

  for (const item of pathname.split("/")) {
    if (item.startsWith(":")) {
      array.push(replaceParamWithValue(item, params));
    } else {
      array.push(item);
    }
  }

  return array.join("/");
};

const addQueryToURL = (
  url: URL,
  query: QueryRecord,
  queryCaseTransform: TransformMode = "none",
): URL => {
  if (!isObjectStrict(query)) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    const transformed = transformCase(key, queryCaseTransform);

    if (isArray(value)) {
      url.searchParams.append(transformed, value.join(" "));
    } else {
      url.searchParams.append(transformed, value.toString());
    }
  }

  return url;
};

const addToURL = (url: URL, options: Options = {}): URL => {
  const pathname = addParamsToPathname(url.pathname, options.params);
  const string = url.toString().replace(url.pathname, pathname);
  return addQueryToURL(new URL(string), options.query, options.queryCaseTransform);
};

export const createURL = (pathOrUrl: URL | string, options: Options = {}): URL => {
  if (pathOrUrl instanceof URL) {
    return addToURL(pathOrUrl, options);
  }

  if (pathOrUrl.startsWith("http")) {
    return addToURL(new URL(pathOrUrl), options);
  }

  const destructed = destructUrl(options.host);
  const host = destructed.host;
  const port = destructed.port || options.port;
  const protocol = destructed.protocol || options.protocol || "https";
  const hostAndPort = port ? `${host}:${port}` : host;
  const url = `${protocol}://${hostAndPort}`;

  return addToURL(new URL(pathOrUrl, url), options);
};
