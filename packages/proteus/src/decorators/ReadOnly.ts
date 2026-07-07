import type { ReadOnlyOperation } from "../internal/entity/types/metadata.js";
import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Mark a field as read-only, optionally scoped to a single operation.
 *
 * - `@ReadOnly()` — read-only on both `"update"` and `"upsert"`: the value is set on
 *   INSERT and never changes afterwards (excluded from UPDATE, preserved on upsert conflict).
 * - `@ReadOnly("update")` — excluded from UPDATE statements only; still writable by `upsert()`.
 * - `@ReadOnly("upsert")` — written on INSERT but preserved on an upsert conflict; still
 *   writable via `update()` / `save()`.
 */
export const ReadOnly =
  (operation?: ReadOnlyOperation) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "ReadOnly",
      readonly: operation ? [operation] : ["update", "upsert"],
    });
  };
