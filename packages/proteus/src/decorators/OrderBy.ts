import { stageRelationModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Specifies default ordering for a relation's loaded results.
 *
 * **Not yet implemented** — metadata is staged on the relation's `orderBy`
 * field but no relation-loading code applies ORDER BY based on it. A future
 * release will wire consumption into the relation loading pipeline.
 */
export const OrderBy =
  (spec: Record<string, "ASC" | "DESC">) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationModifier(context.metadata, {
      key: String(context.name),
      decorator: "OrderBy",
      orderBy: spec,
    });
  };
