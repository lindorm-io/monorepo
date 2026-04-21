import type { CteSpec } from "../../../../types/query.js";
import { compileCtes as shared } from "../../../../utils/sql/compile-cte.js";
import { mysqlDialect } from "../mysql-dialect.js";

export const compileCtes = (ctes: Array<CteSpec>, globalParams: Array<unknown>): string =>
  shared(ctes, globalParams, mysqlDialect);
