import { Dict, Param, Query } from "@lindorm/types";
import { CreateUrlOptions } from "../../types/types";
import { _addQueryToURL } from "./add-query-to-url";
import { _replaceParams } from "./replace-params";

export const _addToUrl = <P extends Dict<Param> = Dict<Param>, Q = Dict<Query>>(
  url: URL,
  options: CreateUrlOptions<P, Q>,
): URL => {
  const pathname = _replaceParams<P>(url.pathname, options.params);
  const string = url.toString().replace(url.pathname, pathname);

  return _addQueryToURL<Q>(new URL(string), options.query, options.changeQueryCase);
};
