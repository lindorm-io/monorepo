import type { CteSpec } from "#internal/types/query";
import { compileCtes as shared } from "#internal/utils/sql/compile-cte";
import { sqliteDialect } from "../sqlite-dialect";

export const compileCtes = (ctes: Array<CteSpec>, globalParams: Array<unknown>): string =>
  shared(ctes, globalParams, sqliteDialect);
