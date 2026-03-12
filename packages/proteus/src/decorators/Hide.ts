import type { QueryScope } from "#internal/entity/types/metadata";
import { stageFieldModifier } from "#internal/entity/metadata/stage-metadata";

/**
 * Hides a field from query results for the given scope.
 *
 * - `@Hide()` hides from both single and multiple queries.
 * - `@Hide("single")` hides only from findOne results.
 * - `@Hide("multiple")` hides only from find results.
 */
export const Hide =
  (scope?: QueryScope) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Hide",
      hideOn: scope ? [scope] : ["single", "multiple"],
    });
  };
