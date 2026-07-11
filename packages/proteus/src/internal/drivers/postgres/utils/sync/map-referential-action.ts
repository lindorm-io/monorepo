import type {
  RelationChange,
  RelationDestroy,
} from "../../../../entity/types/metadata.js";
import { PostgresSyncError } from "../../errors/PostgresSyncError.js";

/**
 * Maps a relation's onDestroy value to the PostgreSQL ON DELETE referential
 * action. Postgres supports the full set, including SET DEFAULT.
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
      throw new PostgresSyncError(
        `Unsupported onDestroy value: "${onDestroy as string}"`,
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details: `onDestroy value "${onDestroy as string}" has no ON DELETE referential action mapping.`,
        },
      );
  }
};

/**
 * Maps a relation's onUpdate value to the PostgreSQL ON UPDATE referential
 * action. Postgres supports the full set, including SET DEFAULT.
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
      throw new PostgresSyncError(`Unsupported onUpdate value: "${onUpdate as string}"`, {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details: `onUpdate value "${onUpdate as string}" has no ON UPDATE referential action mapping.`,
      });
  }
};
