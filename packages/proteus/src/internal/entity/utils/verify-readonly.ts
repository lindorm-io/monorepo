import type { Constructor, DeepPartial } from "@lindorm/types";
import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { IEntity } from "../../../interfaces/index.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";

/**
 * Blocks ALL readonly fields regardless of decorator type.
 *
 * Used to enforce that users haven't manually changed any readonly field
 * in an update payload. This is stricter than `removeReadonlyDataFields`,
 * which only strips user-facing readonly fields (decorator === "Field").
 */
export const verifyReadonly = <E extends IEntity>(
  target: Constructor<E>,
  entity: DeepPartial<E>,
): void => {
  const metadata = getEntityMetadata(target);
  for (const key of Object.keys(entity)) {
    const field = metadata.fields.find((f) => f.key === key);
    if (!field) continue;
    if (field.readonly) {
      throw new EntityMetadataError("Field is readonly", { debug: { key, entity } });
    }
  }
};
