import type { SetOperationEntry } from "#internal/types/query";
import { compileSetOperations as shared } from "#internal/utils/sql/compile-set-operation";
import { sqliteDialect } from "../sqlite-dialect";

export const compileSetOperations = (
  entries: Array<SetOperationEntry>,
  globalParams: Array<unknown>,
): string => shared(entries, globalParams, sqliteDialect);
