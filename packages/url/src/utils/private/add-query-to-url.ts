import { ChangeCase, changeCase } from "@lindorm/case";
import { isArray, isObject } from "@lindorm/is";
import { Dict, Query } from "@lindorm/types";

export const _addQueryToURL = <Q = Dict<Query>>(
  url: URL,
  query?: Q,
  queryCaseTransform?: ChangeCase,
): URL => {
  if (!isObject(query)) {
    return url;
  }

  for (const [key, value] of Object.entries(query)) {
    const transformed = queryCaseTransform ? changeCase(key, queryCaseTransform) : key;

    if (isArray(value)) {
      url.searchParams.append(transformed, value.join(" "));
    } else if (value) {
      url.searchParams.append(transformed, value.toString());
    }
  }

  return url;
};
