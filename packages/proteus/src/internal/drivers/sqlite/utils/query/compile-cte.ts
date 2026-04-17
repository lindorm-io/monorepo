import type { CteSpec } from "../../../../types/query";
import { compileCtes as shared } from "../../../../utils/sql/compile-cte";
import { sqliteDialect } from "../sqlite-dialect";

export const compileCtes = (ctes: Array<CteSpec>, globalParams: Array<unknown>): string =>
  shared(ctes, globalParams, sqliteDialect);
