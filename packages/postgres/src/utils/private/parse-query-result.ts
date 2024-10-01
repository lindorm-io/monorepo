import { isObject, isString } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import { Dict } from "@lindorm/types";
import { PostgresResult } from "../../types";

export const parseQueryResult = <T extends Dict>(
  result: PostgresResult<T>,
): PostgresResult<T> => {
  if (!result.rowCount || !result.rows.length) {
    return { ...result, rows: [] };
  }

  const rows: Array<T> = [];

  for (const row of result.rows) {
    const data: Dict = {};

    for (const [key, value] of Object.entries(row)) {
      if (isObject(value) && value.__meta__ && (value.__array__ || value.__record__)) {
        data[key] = JsonKit.parse(value);
      } else if (isString(value) && value.startsWith("[")) {
        data[key] = JSON.parse(value);
      } else {
        data[key] = value;
      }
    }

    rows.push(data as T);
  }

  return { ...result, rows };
};
