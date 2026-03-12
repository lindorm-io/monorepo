import type { SetOperationEntry } from "#internal/types/query";
import { compileSetOperations as shared } from "#internal/utils/sql/compile-set-operation";
import { mysqlDialect } from "../mysql-dialect";

export const compileSetOperations = (
  entries: Array<SetOperationEntry>,
  globalParams: Array<unknown>,
): string => shared(entries, globalParams, mysqlDialect);
