import type {
  RelationChange,
  RelationDestroy,
} from "../../../../entity/types/metadata.js";
import { SqliteSyncError } from "../../errors/SqliteSyncError.js";

/**
 * Maps a relation's onDestroy value to the SQLite ON DELETE referential
 * action. SQLite supports the full set, including SET DEFAULT.
 */
export const mapOnDeleteAction = (onDestroy: RelationDestroy): string => {
  switch (onDestroy) {
    case "cascade":
      return "CASCADE";
    case "restrict":
      return "RESTRICT";
    case "set_null":
      return "SET NULL";
    case "set_default":
      return "SET DEFAULT";
    case "ignore":
      return "NO ACTION";
    default:
      throw new SqliteSyncError(`Unsupported onDestroy value: "${onDestroy as string}"`, {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          "The relation's onDestroy action does not map to a SQLite ON DELETE action.",
        data: { onDestroy: onDestroy as string },
      });
  }
};

/**
 * Maps a relation's onUpdate value to the SQLite ON UPDATE referential
 * action. SQLite supports the full set, including SET DEFAULT.
 */
export const mapOnUpdateAction = (onUpdate: RelationChange): string => {
  switch (onUpdate) {
    case "cascade":
      return "CASCADE";
    case "restrict":
      return "RESTRICT";
    case "set_null":
      return "SET NULL";
    case "set_default":
      return "SET DEFAULT";
    case "ignore":
      return "NO ACTION";
    default:
      throw new SqliteSyncError(`Unsupported onUpdate value: "${onUpdate as string}"`, {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          "The relation's onUpdate action does not map to a SQLite ON UPDATE action.",
        data: { onUpdate: onUpdate as string },
      });
  }
};
