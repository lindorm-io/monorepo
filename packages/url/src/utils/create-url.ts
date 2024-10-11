import { Dict, Param, Query } from "@lindorm/types";
import { CreateUrlOptions } from "../types/types";
import { createBaseUrl } from "./create-base-url";
import { extractSearchParams } from "./extract-search-params";
import { addToUrl } from "./private";

export const createUrl = <P extends Dict<Param> = Dict<Param>, Q = Dict<Query>>(
  pathOrUrl: URL | string,
  options: CreateUrlOptions<P, Q> = {},
): URL => {
  if (pathOrUrl instanceof URL) {
    return addToUrl<P, Q>(pathOrUrl, options);
  }

  if (pathOrUrl.startsWith("http")) {
    return addToUrl<P, Q>(new URL(pathOrUrl), options);
  }

  const baseURL = options.host || options.baseUrl;

  if (!baseURL) {
    throw new Error(`Invalid base [ ${baseURL} ]`);
  }

  const url = createBaseUrl({
    base: options.baseUrl,
    host: options.host,
    port: options.port,
  });

  const pathname = url.pathname.length ? `${url.pathname}${pathOrUrl}` : pathOrUrl;
  const path = pathname.replace(/\/\//, "/");

  const searchParams = extractSearchParams<Q>(url);

  return addToUrl<P, Q>(new URL(path, url), {
    ...options,
    query: { ...searchParams, ...(options.query || {}) },
  });
};
