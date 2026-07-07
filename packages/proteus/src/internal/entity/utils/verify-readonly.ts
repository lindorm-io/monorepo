import type { Constructor, DeepPartial } from "@lindorm/types";
import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { IEntity } from "../../../interfaces/index.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

/**
 * Blocks all update-readonly fields regardless of decorator type.
 *
 * Used to enforce that users haven't manually changed an update-readonly field
 * in an update payload. This is stricter than `removeReadonlyDataFields`,
 * which only strips user-facing readonly fields (decorator === "Field").
 *
 * Fields that are readonly on "upsert" only remain writable via update(), so
 * they are not blocked here.
 */
export const verifyReadonly = <E extends IEntity>(
  target: Constructor<E>,
  entity: DeepPartial<E>,
): void => {
  const metadata = getEntityMetadata(target);
  for (const key of Object.keys(entity)) {
    const field = metadata.fields.find((f) => f.key === key);
    if (!field) continue;
    if (field.readonly.includes("update")) {
      throw new EntityMetadataError("Field is readonly", {
        code: "readonly_field",
        title: "Readonly Field",
        details: `The update payload attempts to change readonly field "${key}"; remove it from the payload as readonly fields cannot be modified after creation.`,
        data: { key },
        debug: { entity },
      });
    }
  }
};
