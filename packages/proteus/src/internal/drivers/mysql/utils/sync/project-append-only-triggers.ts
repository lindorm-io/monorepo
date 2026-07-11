import type { DesiredTriggerModel } from "../../../../utils/sync/desired-schema-model.js";
import { generateAppendOnlyDDL } from "../ddl/generate-append-only-ddl.js";

/**
 * Groups the MySQL append-only DDL into per-trigger models. The DDL comes in
 * DROP IF EXISTS + CREATE TRIGGER pairs — one pair per trigger.
 */
export const projectAppendOnlyTriggers = (
  tableName: string,
): Array<DesiredTriggerModel> => {
  const triggers: Array<DesiredTriggerModel> = [];

  const allStatements = generateAppendOnlyDDL(tableName);
  for (let i = 0; i < allStatements.length; i += 2) {
    const dropStmt = allStatements[i];
    const createStmt = allStatements[i + 1];
    const nameMatch = createStmt.match(/CREATE TRIGGER `([^`]+)`/);
    const triggerName = nameMatch ? nameMatch[1] : `proteus_trigger_${i}`;
    triggers.push({ name: triggerName, statements: [dropStmt, createStmt] });
  }

  return triggers;
};
