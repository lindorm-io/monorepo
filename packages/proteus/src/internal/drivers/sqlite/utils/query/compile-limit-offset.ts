import { compileLimitOffset as shared } from "../../../../utils/sql/compile-limit-offset.js";
import { sqliteDialect } from "../sqlite-dialect.js";

export const compileLimitOffset = (
  skip: number | null,
  take: number | null,
  params: Array<unknown>,
): string => shared(skip, take, params, sqliteDialect);
