import type { RelationOrphan } from "../internal/entity/types/metadata";
import { stageRelationModifier } from "../internal/entity/metadata/stage-metadata";

/**
 * Configure what happens to related entities that are removed from a collection.
 *
 * - `"destroy"` — permanently delete orphaned entities
 * - `"soft-destroy"` — soft-delete orphaned entities
 * - `"nullify"` — set the FK to null on orphaned entities
 * - `"ignore"` — do nothing (default)
 */
export const OnOrphan =
  (strategy: RelationOrphan) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationModifier(context.metadata, {
      key: String(context.name),
      decorator: "OnOrphan",
      onOrphan: strategy,
    });
  };
