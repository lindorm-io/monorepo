import { stageFieldModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Attach a DDL comment to a column (e.g. PostgreSQL `COMMENT ON COLUMN`).
 */
export const Comment =
  (comment: string) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Comment",
      comment,
    });
  };
