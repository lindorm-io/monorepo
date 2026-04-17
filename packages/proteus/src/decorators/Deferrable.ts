import { stageRelationModifier } from "../internal/entity/metadata/stage-metadata";

export type DeferrableOptions = {
  /** If `true`, the constraint is `INITIALLY DEFERRED`. Default: `false` (INITIALLY IMMEDIATE). */
  initially?: boolean;
};

/**
 * Mark a relation's FK constraint as `DEFERRABLE`.
 *
 * - `@Deferrable()` — `DEFERRABLE INITIALLY IMMEDIATE`
 * - `@Deferrable({ initially: true })` — `DEFERRABLE INITIALLY DEFERRED`
 */
export const Deferrable =
  (options: DeferrableOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelationModifier(context.metadata, {
      key: String(context.name),
      decorator: "Deferrable",
      deferrable: true,
      initiallyDeferred: options.initially ?? false,
    });
  };
