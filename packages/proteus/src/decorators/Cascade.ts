import type { RelationChange, RelationDestroy } from "#internal/entity/types/metadata";
import { stageRelationModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Options for cascade behavior on a relation.
 */
export type CascadeOptions = {
  /** Cascade insert: `"cascade"` to auto-insert related entities. */
  onInsert?: RelationChange;
  /** Cascade update: `"cascade"` to auto-update related entities. */
  onUpdate?: RelationChange;
  /** Cascade destroy: `"cascade"` to delete related entities, `"soft"` for soft-delete. */
  onDestroy?: RelationDestroy;
  /** Cascade soft-destroy: `"cascade"` to soft-delete related entities. */
  onSoftDestroy?: RelationDestroy;
};

/**
 * Configure cascade behavior for a relation.
 *
 * Controls what happens to related entities when the parent entity
 * is inserted, updated, destroyed, or soft-destroyed.
 */
export const Cascade =
  (options: CascadeOptions) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationModifier(context.metadata, {
      key: String(context.name),
      decorator: "Cascade",
      cascade: options,
    });
  };
