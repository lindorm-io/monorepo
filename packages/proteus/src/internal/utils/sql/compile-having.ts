import type { Dict, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { PredicateEntry, RawWhereEntry } from "../../types/query.js";
import type { SqlDialect } from "./sql-dialect.js";

export type CompilePredicateFn = (
  predicate: Predicate<Dict>,
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
) => string;

export const compileHaving = <E extends IEntity>(
  entries: Array<PredicateEntry<E>>,
  rawEntries: Array<RawWhereEntry>,
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
  dialect: SqlDialect,
  compilePredicate: CompilePredicateFn,
): string => {
  if (entries.length === 0 && rawEntries.length === 0) return "";

  const clauses: Array<string> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const compiled = compilePredicate(
      entry.predicate as Predicate<Dict>,
      metadata,
      tableAlias,
      params,
    );
    if (!compiled) continue;

    if (clauses.length === 0) {
      clauses.push(compiled);
    } else {
      const conjunction = entry.conjunction === "or" ? "OR" : "AND";
      clauses.push(`${conjunction} ${compiled}`);
    }
  }

  for (const raw of rawEntries) {
    let sql: string;

    if (dialect.reindexRawParams) {
      sql = dialect.reindexRawParams(raw.sql, raw.params, params);
    } else {
      params.push(...raw.params);
      sql = raw.sql;
    }

    if (clauses.length === 0) {
      clauses.push(sql);
    } else {
      const conjunction = raw.conjunction === "or" ? "OR" : "AND";
      clauses.push(`${conjunction} ${sql}`);
    }
  }

  if (clauses.length === 0) return "";
  return `HAVING ${clauses.join(" ")}`;
};
