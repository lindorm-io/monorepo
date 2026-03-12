import { stageRelationCount } from "#internal/entity/metadata/stage-metadata";

/**
 * Marks a field as a computed relation array length.
 *
 * **Not yet implemented** — metadata is staged but no runtime pipeline
 * consumes it. The decorator compiles and stages data correctly; a future
 * release will wire consumption into the query/hydration layer.
 */
export const RelationCount =
  <E>(relationKey: keyof E & string) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationCount(context.metadata, {
      key: String(context.name),
      relationKey,
    });
  };
