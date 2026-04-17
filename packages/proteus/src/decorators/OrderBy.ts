import { stageRelationModifier } from "../internal/entity/metadata/stage-metadata";

/**
 * Specifies default ordering for a relation's loaded results.
 *
 * Applied as an ORDER BY clause in SQL relation queries and as in-memory
 * sorting during hydration. Supported across all six drivers.
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
