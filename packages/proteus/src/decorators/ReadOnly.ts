import { stageFieldModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Mark a field as read-only.
 *
 * Read-only fields are excluded from UPDATE statements after initial insert.
 * The field value is still set during entity creation.
 */
export const ReadOnly =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "ReadOnly",
      readonly: true,
    });
  };
