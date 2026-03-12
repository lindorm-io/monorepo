import type { Constructor, DeepPartial } from "@lindorm/types";
import { IEntity } from "../../../interfaces";
import { getEntityMetadata } from "../metadata/get-entity-metadata";

/**
 * Removes user-facing readonly fields (decorator === "Field" && readonly === true).
 *
 * System-managed readonly fields (Version, UpdateDate, CreateDate) are KEPT
 * because their decorators are not "Field" — the update pipeline sets these
 * values and they must reach the database.
 *
 * Compare with `verifyReadonly`, which blocks ALL readonly fields regardless
 * of decorator to enforce that users haven't manually changed them.
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
    if (field.decorator !== "Field" || !field.readonly) {
      (result as any)[key] = value;
    }
  }
  return result;
};
