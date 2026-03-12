import type { CteSpec } from "#internal/types/query";
import type { SqlDialect } from "./sql-dialect";

export const compileCtes = (
  ctes: Array<CteSpec>,
  globalParams: Array<unknown>,
  dialect: SqlDialect,
): string => {
  if (ctes.length === 0) return "";

  const definitions = ctes.map((cte) => {
    let sql: string;

    if (dialect.reindexRawParams) {
      sql = dialect.reindexRawParams(cte.sql, cte.params, globalParams);
    } else {
      globalParams.push(...cte.params);
      sql = cte.sql;
    }

    const matHint =
      dialect.supportsMaterializedCte && cte.materialized === true
        ? " MATERIALIZED"
        : dialect.supportsMaterializedCte && cte.materialized === false
          ? " NOT MATERIALIZED"
          : "";

    return `${dialect.quoteIdentifier(cte.name)} AS${matHint} (${sql})`;
  });

  return `WITH ${definitions.join(", ")}`;
};
