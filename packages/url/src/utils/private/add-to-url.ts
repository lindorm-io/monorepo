import { Dict, Param, Query } from "@lindorm/types";
import { CreateUrlOptions } from "../../types/types";
import { addQueryToURL } from "./add-query-to-url";
import { replaceParams } from "./replace-params";

export const addToUrl = <P extends Dict<Param> = Dict<Param>, Q = Dict<Query>>(
  url: URL,
  options: CreateUrlOptions<P, Q>,
): URL => {
  const pathname = replaceParams<P>(url.pathname, options.params);
  const string = url.toString().replace(url.pathname, pathname);

  return addQueryToURL<Q>(new URL(string), options.query, options.changeQueryCase);
};
