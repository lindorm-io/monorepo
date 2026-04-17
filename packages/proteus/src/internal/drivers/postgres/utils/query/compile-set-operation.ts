import type { SetOperationEntry } from "../../../../types/query";
import { compileSetOperations as shared } from "../../../../utils/sql/compile-set-operation";
import { postgresDialect } from "../postgres-dialect";

export const compileSetOperations = (
  entries: Array<SetOperationEntry>,
  globalParams: Array<unknown>,
): string => shared(entries, globalParams, postgresDialect);
