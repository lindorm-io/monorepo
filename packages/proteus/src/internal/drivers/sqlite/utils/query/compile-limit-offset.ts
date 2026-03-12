import { compileLimitOffset as shared } from "#internal/utils/sql/compile-limit-offset";
import { sqliteDialect } from "../sqlite-dialect";

export const compileLimitOffset = (
  skip: number | null,
  take: number | null,
  params: Array<unknown>,
): string => shared(skip, take, params, sqliteDialect);
