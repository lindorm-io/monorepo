import type { QueryScope } from "../internal/entity/types/metadata.js";
import { stageRelationModifier } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Load a relation lazily — the property returns a `PromiseLike<T>` that resolves on first access.
 *
 * - `@Lazy()` — lazy-load for both `findOne` and `find` queries
 * - `@Lazy("single")` — only lazy-load for `findOne`
 * - `@Lazy("multiple")` — only lazy-load for `find`
 *
 * Use `LazyType<T>` as the property type for lazy-loaded relations.
 */
export const Lazy =
  (scope?: QueryScope) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationModifier(context.metadata, {
      key: String(context.name),
      decorator: scope ? `Lazy:${scope}` : "Lazy",
      loading: "lazy",
      loadingScope: scope,
    });
  };
