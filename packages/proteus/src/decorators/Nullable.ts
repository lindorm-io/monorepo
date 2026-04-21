import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Mark a field as nullable, allowing `null` values in the database.
 *
 * Affects both DDL generation (column allows NULL) and Zod validation.
 */
export const Nullable =
  () =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Nullable",
      nullable: true,
    });
  };
