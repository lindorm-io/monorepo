import { isArray, isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata, MetaField } from "../types/metadata.js";

/** Placeholder emitted in error/log output instead of a sensitive field value. */
export const REDACTED = "[Filtered]";

/**
 * Replace a field value with "[Filtered]" when the field is marked @Sensitive.
 * Used at every site where a raw field value would otherwise escape into
 * error-debug payloads — proteus must never emit a sensitive value.
 */
export const redactSensitive = (
  field: Pick<MetaField, "sensitive"> | undefined,
  value: unknown,
): unknown => (field?.sensitive ? REDACTED : value);

/**
 * Redacted copy of a whole entity, for the sites that log the entity itself.
 *
 * Statements are parameterised and their bindings are never logged, so an entity's values
 * reach a log only here — which is exactly why @Sensitive has to hold on this path too.
 * The entity is never mutated; only the sensitive values are replaced.
 *
 * Covers all three shapes a field can take: a flat column, an @Embedded field (keyed
 * `parent.child` against a nested object), and an @EmbeddedList element field (keyed
 * against every object in the array).
 */
export const redactSensitiveEntity = <E extends Dict>(
  metadata: Pick<EntityMetadata, "fields" | "embeddedLists">,
  entity: E,
): E => {
  const sensitive = metadata.fields.filter((field) => field.sensitive);
  const sensitiveLists = metadata.embeddedLists.filter((list) =>
    list.elementFields?.some((field) => field.sensitive),
  );

  if (!sensitive.length && !sensitiveLists.length) return entity;

  const result: Dict = { ...entity };

  for (const field of sensitive) {
    // An @Embedded field is keyed `parent.child` and lives on a nested object.
    if (field.embedded) {
      const { parentKey } = field.embedded;
      const child = field.key.slice(parentKey.length + 1);
      const parent = result[parentKey];

      if (isObject(parent) && parent[child] !== undefined) {
        result[parentKey] = { ...parent, [child]: REDACTED };
      }

      continue;
    }

    if (result[field.key] !== undefined) result[field.key] = REDACTED;
  }

  for (const list of sensitiveLists) {
    const elements = result[list.key];

    if (!isArray(elements)) continue;

    const keys = (list.elementFields ?? [])
      .filter((field) => field.sensitive)
      .map((field) => field.key);

    result[list.key] = elements.map((element) => {
      if (!isObject(element)) return element;

      const copy: Dict = { ...element };

      for (const key of keys) {
        if (copy[key] !== undefined) copy[key] = REDACTED;
      }

      return copy;
    });
  }

  return result as E;
};
