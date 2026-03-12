import type { SqlDialect } from "./sql-dialect";

export const compileLimitOffset = (
  skip: number | null,
  take: number | null,
  params: Array<unknown>,
  dialect: SqlDialect,
): string => {
  const parts: Array<string> = [];

  if (take != null) {
    params.push(take);
    parts.push(`LIMIT ${dialect.placeholder(params)}`);
  } else if (skip != null && dialect.requiresLimitForOffset) {
    parts.push(`LIMIT 18446744073709551615`);
  }

  if (skip != null) {
    params.push(skip);
    parts.push(`OFFSET ${dialect.placeholder(params)}`);
  }

  return parts.join(" ");
};
