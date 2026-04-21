import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Mark a field as a computed/generated column with the given SQL expression.
 *
 * Computed fields are excluded from INSERT/UPDATE statements and Zod validation.
 * The database evaluates the expression on read (or on write for STORED columns).
 */
export const Computed =
  (expression: string) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Computed",
      computed: expression,
    });
  };
