import { stageRelationCount } from "#internal/entity/metadata/stage-metadata";

/**
 * Populates a field with the count of a related collection via a batched
 * COUNT(*) ... GROUP BY query. Avoids loading the full relation just to
 * get the count. Supports OneToMany and ManyToMany relations, including
 * composite keys.
 */
export const RelationCount =
  <E>(relationKey: keyof E & string) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationCount(context.metadata, {
      key: String(context.name),
      relationKey,
    });
  };
