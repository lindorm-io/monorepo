import { isBoolean, isNumber, isString } from "@lindorm/is";
import type { MetaField, MetaGenerated } from "../../../../entity/types/metadata.js";
import type { ProjectedColumnBehavior } from "../../../../utils/sync/sync-dialect.js";

/**
 * SQLite column-behavior projection: only the increment strategy maps to
 * AUTOINCREMENT (`@Generated("identity")` is ignored — known drift), uuid is
 * generated app-side (no default), and boolean defaults are spelled 1/0.
 * The generated expression is projected but dropped by the sqlite mapper
 * (sqlite's desired schema carries no computed columns — known drift).
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
