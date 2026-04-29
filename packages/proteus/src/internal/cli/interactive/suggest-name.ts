import { kebabCase } from "@lindorm/case";
import type { SyncOperation } from "../../drivers/postgres/types/sync-plan.js";

const inferPrefix = (operations: Array<SyncOperation>): string => {
  let creates = 0;
  let alters = 0;
  let drops = 0;

  for (const op of operations) {
    if (op.type === "create_table") creates++;
    else if (
      op.type === "drop_column" ||
      op.type === "drop_constraint" ||
      op.type === "drop_index" ||
      op.type === "drop_and_readd_column"
    )
      drops++;
    else alters++;
  }

  if (creates >= alters && creates >= drops) return "add";
  if (drops >= creates && drops >= alters) return "drop";
  return "update";
};

export const suggestMigrationName = (
  entityNames: Array<string>,
  operations: Array<SyncOperation>,
): string => {
  const prefix = inferPrefix(operations);
  const names = entityNames.map((n) => kebabCase(n)).filter(Boolean);

  if (names.length === 0) {
    return `${prefix}-schema`;
  }

  if (names.length <= 2) {
    return `${prefix}-${names.join("-and-")}`;
  }

  return `${prefix}-${names[0]}-and-more`;
};
