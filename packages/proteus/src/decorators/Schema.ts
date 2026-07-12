import type { z } from "zod";
import { EntityMetadataError } from "../internal/entity/errors/EntityMetadataError.js";
import {
  stageFieldModifier,
  stageSchema,
} from "../internal/entity/metadata/stage-metadata.js";

// Duck-check instead of `instanceof z.ZodObject` — safe across duplicate zod
// installs. Zod 4 exposes the schema kind at `def.type` ("object" covers
// z.object / z.strictObject / z.looseObject).
const isZodObjectSchema = (schema: z.ZodType): boolean =>
  (schema as any)?.def?.type === "object";

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
      // The class branch parses the WHOLE entity, so anything but an object
      // schema is a mistake — fail at decoration time, not at first validate
      if (!isZodObjectSchema(schema)) {
        throw new EntityMetadataError(
          `Class-level @Schema on "${String(context.name)}" requires a Zod object schema`,
          {
            code: "invalid_class_schema",
            title: "Invalid Class Schema",
            details: `Class-level @Schema on "${String(context.name)}" received a non-object Zod schema — the entity is parsed as a whole, so pass z.object({ ... }) (or use a field-level @Schema for a single column).`,
            debug: { target: String(context.name) },
          },
        );
      }
      stageSchema(context.metadata, schema as z.ZodObject<any>);
    }
  };
}
