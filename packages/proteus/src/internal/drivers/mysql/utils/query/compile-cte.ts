import type { CteSpec } from "../../../../types/query";
import { compileCtes as shared } from "../../../../utils/sql/compile-cte";
import { mysqlDialect } from "../mysql-dialect";

export const compileCtes = (ctes: Array<CteSpec>, globalParams: Array<unknown>): string =>
  shared(ctes, globalParams, mysqlDialect);
