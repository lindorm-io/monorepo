import type { CteSpec } from "#internal/types/query";
import { compileCtes as shared } from "#internal/utils/sql/compile-cte";
import { mysqlDialect } from "../mysql-dialect";

export const compileCtes = (ctes: Array<CteSpec>, globalParams: Array<unknown>): string =>
  shared(ctes, globalParams, mysqlDialect);
