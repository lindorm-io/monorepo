import type { MetaFieldDefault } from "#internal/entity/types/metadata";
import { stageFieldModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Set a default value for a field, applied when creating new entities.
 *
 * Accepts a literal value or a function that returns the default at creation time.
 */
export const Default =
  (value: MetaFieldDefault) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Default",
      default: value,
    });
  };
