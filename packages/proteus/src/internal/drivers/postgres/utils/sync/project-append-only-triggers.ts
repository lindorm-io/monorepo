import type { DesiredTriggerModel } from "../../../../utils/sync/desired-schema-model.js";
import { generateAppendOnlyDDL } from "../ddl/generate-append-only-ddl.js";

/**
 * Groups the postgres append-only DDL into per-trigger models. The first DDL
 * statement is the shared guard function (CREATE OR REPLACE FUNCTION); the
 * rest are DROP IF EXISTS + CREATE TRIGGER pairs. The guard function rides
 * with the first trigger's statements (idempotent).
 */
export const projectAppendOnlyTriggers = (
  tableName: string,
  namespace: string | null,
): Array<DesiredTriggerModel> => {
  const triggers: Array<DesiredTriggerModel> = [];

  const allStatements = generateAppendOnlyDDL(tableName, namespace);
  const guardFunctionStmt = allStatements[0];
  const perTriggerStmts = allStatements.slice(1);

  for (let i = 0; i < perTriggerStmts.length; i += 2) {
    const dropStmt = perTriggerStmts[i];
    const createStmt = perTriggerStmts[i + 1];
    // Extract trigger name from CREATE TRIGGER "name"
    const nameMatch = createStmt.match(/CREATE TRIGGER "([^"]+)"/);
    const triggerName = nameMatch ? nameMatch[1] : `proteus_trigger_${i}`;

    // Include guard function in first trigger's statements (idempotent)
    const stmts =
      i === 0 ? [guardFunctionStmt, dropStmt, createStmt] : [dropStmt, createStmt];

    triggers.push({ name: triggerName, statements: stmts });
  }

  return triggers;
};
