import { compileLimitOffset as shared } from "../../../../utils/sql/compile-limit-offset";
import { postgresDialect } from "../postgres-dialect";

export const compileLimitOffset = (
  skip: number | null,
  take: number | null,
  params: Array<unknown>,
): string => shared(skip, take, params, postgresDialect);
