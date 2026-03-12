import type { SetOperationEntry } from "#internal/types/query";
import type { SqlDialect } from "./sql-dialect";

export const compileSetOperations = (
  entries: Array<SetOperationEntry>,
  globalParams: Array<unknown>,
  dialect: SqlDialect,
): string => {
  if (entries.length === 0) return "";

  return entries
    .map((entry) => {
      let sql: string;

      if (dialect.reindexRawParams) {
        sql = dialect.reindexRawParams(entry.sql, entry.params, globalParams);
      } else {
        globalParams.push(...entry.params);
        sql = entry.sql;
      }

      return `${entry.operation} ${sql}`;
    })
    .join(" ");
};
