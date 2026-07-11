import type { DesiredTriggerModel } from "../../../../utils/sync/desired-schema-model.js";
import { generateAppendOnlyDDL } from "../ddl/generate-append-only-ddl.js";

/**
 * Groups the SQLite append-only DDL into per-trigger models. Each statement is
 * a standalone CREATE TRIGGER IF NOT EXISTS — one model per statement.
 */
export const projectAppendOnlyTriggers = (
  tableName: string,
): Array<DesiredTriggerModel> => {
  const triggers: Array<DesiredTriggerModel> = [];

  const allStatements = generateAppendOnlyDDL(tableName);
  for (const stmt of allStatements) {
    const nameMatch = stmt.match(/CREATE TRIGGER IF NOT EXISTS "([^"]+)"/);
    const triggerName = nameMatch ? nameMatch[1] : `proteus_trigger`;
    triggers.push({ name: triggerName, statements: [stmt] });
  }

  return triggers;
};
