import { stageFieldModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Set the maximum allowed value for a numeric field, or maximum length for a string field.
 *
 * Enforced during Zod validation and reflected in DDL constraints where supported.
 */
export const Max =
  (value: number) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Max",
      max: value,
    });
  };
