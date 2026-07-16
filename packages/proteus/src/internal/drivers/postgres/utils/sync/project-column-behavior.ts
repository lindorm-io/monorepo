import { isBoolean, isNumber, isString } from "@lindorm/is";
import type { MetaField, MetaGenerated } from "../../../../entity/types/metadata.js";
import type { ProjectedColumnBehavior } from "../../../../utils/sync/sync-dialect.js";

/**
 * Postgres column-behavior projection: computed fields become GENERATED
 * expressions; `increment` becomes an overridable BY DEFAULT identity
 * (`"identity"`) and `identity` a strict ALWAYS identity (`"identity_always"`);
 * uuid generation defaults to gen_random_uuid(); literal defaults keep native
 * spellings (booleans as true/false).
 */
export const projectColumnBehavior = (
  field: MetaField,
  gen: MetaGenerated | undefined,
): ProjectedColumnBehavior => {
  let defaultExpr: string | null = null;
  let identity: ProjectedColumnBehavior["identity"] = null;
  let generatedExpr: string | null = null;

  if (field.computed) {
    generatedExpr = field.computed;
  } else if (gen?.strategy === "increment") {
    identity = "identity";
  } else if (gen?.strategy === "identity") {
    identity = "identity_always";
  } else if (gen?.strategy === "uuid") {
    defaultExpr = "gen_random_uuid()";
  } else if (field.default !== null && typeof field.default !== "function") {
    const d = field.default;
    if (isString(d)) {
      defaultExpr = `'${d.replace(/'/g, "''")}'`;
    } else if (isNumber(d) || typeof d === "bigint") {
      defaultExpr = `${d}`;
    } else if (isBoolean(d)) {
      defaultExpr = `${d}`;
    }
  }

  return { defaultExpr, identity, generatedExpr };
};
