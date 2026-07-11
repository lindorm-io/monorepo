import type {
  RelationChange,
  RelationDestroy,
} from "../../../../entity/types/metadata.js";
import { MySqlSyncError } from "../../errors/MySqlSyncError.js";

/**
 * Maps a relation's onDestroy value to the MySQL ON DELETE referential action.
 * MySQL InnoDB does not support SET DEFAULT — it throws.
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
      throw new MySqlSyncError("SET DEFAULT is not supported by MySQL InnoDB", {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          "MySQL InnoDB does not support the SET DEFAULT referential action on foreign keys.",
      });
    case "ignore":
      return "NO ACTION";
    default:
      throw new MySqlSyncError(`Unsupported onDestroy value: "${onDestroy as string}"`, {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details: "The configured onDestroy referential action is not supported by MySQL.",
        data: { onDestroy: onDestroy as string },
      });
  }
};

/**
 * Maps a relation's onUpdate value to the MySQL ON UPDATE referential action.
 * MySQL InnoDB does not support SET DEFAULT — it throws.
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
      throw new MySqlSyncError("SET DEFAULT is not supported by MySQL InnoDB", {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          "MySQL InnoDB does not support the SET DEFAULT referential action on foreign keys.",
      });
    case "ignore":
      return "NO ACTION";
    default:
      throw new MySqlSyncError(`Unsupported onUpdate value: "${onUpdate as string}"`, {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details: "The configured onUpdate referential action is not supported by MySQL.",
        data: { onUpdate: onUpdate as string },
      });
  }
};
