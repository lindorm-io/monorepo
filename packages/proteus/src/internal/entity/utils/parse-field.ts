import type { DeepPartial } from "@lindorm/types";
import { EntityManagerError } from "../errors/EntityManagerError";
import { IEntity } from "../../../interfaces";
import type { MetaField } from "../types/metadata";
import { deserialise } from "./deserialise";

/**
 * Phase 1 of two-phase validation: parse and coerce values.
 *
 * Missing required fields receive zero-values from `deserialise()` (e.g. 0, "",
 * false). This is intentional — `nullable: false` is NOT enforced here because
 * the entity pipeline runs create -> generate -> validate, and generated fields
 * (auto-increment, UUIDs, timestamps) won't have values yet at parse time.
 *
 * Phase 2 (`defaultValidateEntity`) applies a Zod schema that enforces all
 * constraints including nullability, after all generated values are populated.
 */
export const parseField = <E extends IEntity, O extends DeepPartial<E> = DeepPartial<E>>(
  field: MetaField,
  entity: E,
  options: O = {} as O,
): any => {
  const value = (options as any)[field.key] ?? (entity as any)[field.key];
  if (value === null || value === undefined) {
    if (field.nullable) return value;
    if (field.default !== null) {
      return typeof field.default === "function" ? field.default() : field.default;
    }
  }
  try {
    return deserialise(value, field.type);
  } catch (error) {
    throw new EntityManagerError(
      `Failed to parse field "${field.key}" of type ${field.type}`,
      {
        debug: { field: field.key, value, type: typeof value, error },
      },
    );
  }
};
