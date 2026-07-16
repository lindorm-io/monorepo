import { isBoolean, isNumber, isString } from "@lindorm/is";
import type { MetaField, MetaGenerated } from "../../../../entity/types/metadata.js";
import type { ProjectedColumnBehavior } from "../../../../utils/sync/sync-dialect.js";
import { SqliteSyncError } from "../../errors/SqliteSyncError.js";

/**
 * SQLite column-behavior projection: the increment strategy maps to
 * AUTOINCREMENT (overridable); `@Generated("identity")` THROWS — SQLite has no
 * strict identity mode (AUTOINCREMENT is always overridable). uuid is generated
 * app-side (no default), and boolean defaults are spelled 1/0. The generated
 * expression is carried through to the sqlite mapper, which emits
 * `GENERATED ALWAYS AS (expr) STORED`.
 */
export const projectColumnBehavior = (
  field: MetaField,
  gen: MetaGenerated | undefined,
): ProjectedColumnBehavior => {
  let defaultExpr: string | null = null;
  let identity: ProjectedColumnBehavior["identity"] = null;

  if (field.computed) {
    // Computed columns have no default, no autoincrement
  } else if (gen?.strategy === "increment") {
    identity = "auto_increment";
  } else if (gen?.strategy === "identity") {
    throw new SqliteSyncError(
      `@Generated("identity") is not supported by SQLite on column "${field.key}"`,
      {
        code: "unsupported_operation",
        title: "Unsupported Operation",
        details:
          'SQLite has no strict GENERATED ALWAYS AS IDENTITY mode (AUTOINCREMENT is always overridable); use @Generated("increment") for a portable auto-increment column.',
      },
    );
  } else if (gen?.strategy === "uuid") {
    // UUID generated app-side; no default in SQLite
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
