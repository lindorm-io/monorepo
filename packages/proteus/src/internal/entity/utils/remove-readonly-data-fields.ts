import type { Constructor, DeepPartial } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

/**
 * Removes user-facing update-readonly fields (decorator === "Field" whose
 * readonly scope includes "update").
 *
 * System-managed readonly fields (Version, UpdateDate, CreateDate) are KEPT
 * because their decorators are not "Field" — the update pipeline sets these
 * values and they must reach the database. Fields that are readonly on "upsert"
 * only are also KEPT — they remain writable via update() / save().
 *
 * Compare with `verifyReadonly`, which blocks all update-readonly fields
 * regardless of decorator to enforce that users haven't manually changed them.
 */
export const removeReadonlyDataFields = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): DeepPartial<E> => {
  const metadata = getEntityMetadata(target);
  const result: DeepPartial<E> = {};
  for (const [key, value] of Object.entries(entity)) {
    const field = metadata.fields.find((f) => f.key === key);
    if (!field) continue;
    if (field.decorator !== "Field" || !field.readonly.includes("update")) {
      (result as any)[key] = value;
    }
  }
  return result;
};
