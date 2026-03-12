import { stageFieldModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Restrict a field to a fixed set of allowed values.
 *
 * Pass a TypeScript enum or a plain `Record<string, string | number>`.
 * Enforced during Zod validation and mapped to a CHECK constraint or
 * native ENUM type depending on the driver.
 */
export const Enum =
  (values: Record<string, string | number>) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Enum",
      enum: values,
    });
  };
