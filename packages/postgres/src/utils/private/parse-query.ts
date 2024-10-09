import { isObject, isString } from "@lindorm/is";
import { QueryConfig, QueryConfigValues } from "pg";
import { PostgresError } from "../../errors";

const trim = (query: string): string =>
  query
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(" ");

const replacePlaceholders = (query: string): string => {
  let num = 1;

  for (let i = 0; i < query.length; i++) {
    if (query[i] !== "?") continue;
    query = query.slice(0, i) + `$${num}` + query.slice(i + 1);
    num++;
  }

  return query;
};

export const parseQuery = <V = Array<any>>(
  queryTextOrConfig: string | QueryConfig<V>,
  values?: QueryConfigValues<V>,
): QueryConfig<V> => {
  if (isObject(queryTextOrConfig)) {
    if (isString(queryTextOrConfig.text)) {
      queryTextOrConfig.text = replacePlaceholders(trim(queryTextOrConfig.text));
    }
    return queryTextOrConfig;
  }

  if (isString(queryTextOrConfig)) {
    return { text: replacePlaceholders(trim(queryTextOrConfig)), values };
  }

  throw new PostgresError("Invalid query", { debug: { queryTextOrConfig } });
};
