import type { SetOperationEntry } from "../../../../types/query.js";
import { compileSetOperations as shared } from "../../../../utils/sql/compile-set-operation.js";
import { mysqlDialect } from "../mysql-dialect.js";

export const compileSetOperations = (
  entries: Array<SetOperationEntry>,
  globalParams: Array<unknown>,
): string => shared(entries, globalParams, mysqlDialect);
