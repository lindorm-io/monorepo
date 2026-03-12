import type { QueryScope } from "#internal/entity/types/metadata";
import { stageRelationModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Automatically load a relation alongside every query result (eager loading).
 *
 * - `@Eager()` — eager-load for both `findOne` and `find` queries
 * - `@Eager("single")` — only eager-load for `findOne`
 * - `@Eager("multiple")` — only eager-load for `find`
 */
export const Eager =
  (scope?: QueryScope) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationModifier(context.metadata, {
      key: String(context.name),
      decorator: scope ? `Eager:${scope}` : "Eager",
      loading: "eager",
      loadingScope: scope,
    });
  };
