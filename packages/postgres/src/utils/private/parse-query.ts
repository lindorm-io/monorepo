import { isArray, isObject, isString } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
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

const replaceValues = <V>(values: QueryConfigValues<V>): QueryConfigValues<V> => {
  if (!values.length) return values;

  const array: Array<any> = [];

  for (const value of values) {
    if (isObject(value) || (isArray(value) && value.some(isObject))) {
      array.push(JsonKit.stringify(value));
    } else if (isArray(value)) {
      array.push(JSON.stringify(value));
    } else {
      array.push(value);
    }
  }

  return array as QueryConfigValues<V>;
};

export const parseQuery = <V = Array<any>>(
  queryTextOrConfig: string | QueryConfig<V>,
  values?: QueryConfigValues<V>,
): QueryConfig<V> => {
  if (isObject(queryTextOrConfig)) {
    if (isString(queryTextOrConfig.text)) {
      queryTextOrConfig.text = replacePlaceholders(trim(queryTextOrConfig.text));
    }
    if (isArray(queryTextOrConfig.values) && queryTextOrConfig.values.length) {
      queryTextOrConfig.values = replaceValues(queryTextOrConfig.values);
    }
    return queryTextOrConfig;
  }

  if (isString(queryTextOrConfig)) {
    return {
      text: replacePlaceholders(trim(queryTextOrConfig)),
      values: values ? replaceValues(values) : undefined,
    };
  }

  throw new PostgresError("Invalid query", { debug: { queryTextOrConfig } });
};
