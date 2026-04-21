import type { CteSpec } from "../../../../types/query.js";
import { compileCtes as shared } from "../../../../utils/sql/compile-cte.js";
import { sqliteDialect } from "../sqlite-dialect.js";

export const compileCtes = (ctes: Array<CteSpec>, globalParams: Array<unknown>): string =>
  shared(ctes, globalParams, sqliteDialect);
