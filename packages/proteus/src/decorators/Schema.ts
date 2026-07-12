import type { z } from "zod";
import {
  stageFieldModifier,
  stageSchema,
} from "../internal/entity/metadata/stage-metadata.js";

/**
 * Attach a Zod schema for runtime validation. Schemas are evaluated during
 * `repository.validate()` and before every insert/update; validation errors
 * are surfaced as ProteusErrors.
 *
 * - Class-level: `@Schema(z.object({ ... }))` — cross-field rules parsed
 *   against the whole entity, in addition to the field-derived validation.
 * - Field-level: `@Schema(z.array(z.object({ ... })))` — replaces the default
 *   loose validator for that field. Only valid on `json`, `object`, and
 *   `array` fields; composes with `@Nullable` like the built-in validators.
 */
export function Schema(
  schema: z.ZodObject<any>,
): (target: any, context: ClassDecoratorContext | ClassFieldDecoratorContext) => void;
export function Schema(
  schema: z.ZodType,
): (target: undefined, context: ClassFieldDecoratorContext) => void;
export function Schema(schema: z.ZodType): any {
  return (_target: any, context: DecoratorContext) => {
    if (context.kind === "field") {
      stageFieldModifier(context.metadata, {
        key: String(context.name),
        decorator: "Schema",
        schema,
      });
    } else if (context.kind === "class") {
      stageSchema(context.metadata, schema as z.ZodObject<any>);
    }
  };
}
