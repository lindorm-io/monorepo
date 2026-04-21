import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Options for bidirectional value transformation.
 */
export type TransformOptions<TFrom = unknown, TTo = unknown> = {
  /** Transform the entity value before writing to the database. */
  to: (value: TFrom) => TTo;
  /** Transform the raw database value when hydrating the entity. */
  from: (raw: TTo) => TFrom;
};

/**
 * Apply a bidirectional transform to a field value.
 *
 * `to` runs during dehydration (entity → database), `from` runs during hydration (database → entity).
 * Useful for encrypting, serializing, or converting between domain and storage representations.
 */
export const Transform =
  <TFrom = unknown, TTo = unknown>(options: TransformOptions<TFrom, TTo>) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Transform",
      transform: {
        to: options.to as (value: unknown) => unknown,
        from: options.from as (raw: unknown) => unknown,
      },
    });
  };
