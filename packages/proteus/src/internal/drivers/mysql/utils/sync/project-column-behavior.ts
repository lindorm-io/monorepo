import { isBoolean, isNumber, isString } from "@lindorm/is";
import type { MetaField, MetaGenerated } from "../../../../entity/types/metadata.js";
import type { ProjectedColumnBehavior } from "../../../../utils/sync/sync-dialect.js";
import { MySqlSyncError } from "../../errors/MySqlSyncError.js";

/**
 * MySQL column-behavior projection: the increment strategy maps to
 * AUTO_INCREMENT (overridable); `@Generated("identity")` THROWS — InnoDB has no
 * strict `GENERATED ALWAYS AS IDENTITY` mode. uuid is generated app-side (no
 * default), and boolean defaults are spelled 1/0. Computed expressions pass
 * through for field-origin columns.
 */
export const projectColumnBehavior = (
  field: MetaField,
  gen: MetaGenerated | undefined,
): ProjectedColumnBehavior => {
  let defaultExpr: string | null = null;
  let identity: ProjectedColumnBehavior["identity"] = null;

  if (field.computed) {
    // Computed columns have no default or auto-increment
  } else if (gen?.strategy === "increment") {
    identity = "auto_increment";
  } else if (gen?.strategy === "identity") {
    throw new MySqlSyncError(
      `@Generated("identity") is not supported by MySQL InnoDB on column "${field.key}"`,
      {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          'MySQL InnoDB has no strict GENERATED ALWAYS AS IDENTITY mode (AUTO_INCREMENT is always overridable); use @Generated("increment") for a portable auto-increment column.',
      },
    );
  } else if (gen?.strategy === "uuid") {
    // UUID generated app-side; no default in MySQL
  } else if (field.default !== null && typeof field.default !== "function") {
    const d = field.default;
    if (isString(d)) {
      defaultExpr = `'${d.replace(/'/g, "''")}'`;
    } else if (isNumber(d) || typeof d === "bigint") {
      defaultExpr = `${d}`;
    } else if (isBoolean(d)) {
      defaultExpr = `${d ? 1 : 0}`;
    }
  }

  return { defaultExpr, identity, generatedExpr: field.computed ?? null };
};
