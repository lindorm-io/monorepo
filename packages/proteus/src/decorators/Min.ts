import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata";

/**
 * Set the minimum allowed value for a numeric field, or minimum length for a string field.
 *
 * Enforced during Zod validation and reflected in DDL constraints where supported.
 */
export const Min =
  (value: number) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Min",
      min: value,
    });
  };
