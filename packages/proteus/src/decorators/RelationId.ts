import { stageRelationId } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Expose a relation's FK value as a read-only property on the entity.
 *
 * For *ToOne owning relations (single FK), auto-detects the FK column.
 * For composite FK or *ToMany, specify the `column` option to select which
 * FK / PK column this property maps to. Multiple @RelationId decorators
 * may target the same relation for composite keys.
 *
 * @param relationKey - The property name of the relation on the entity.
 * @param options.column - Explicit FK column key (local for owning, foreign PK for inverse).
 */
export const RelationId =
  <E>(relationKey: keyof E & string, options?: { column?: string }) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationId(context.metadata, {
      key: String(context.name),
      relationKey,
      column: options?.column ?? null,
    });
  };
