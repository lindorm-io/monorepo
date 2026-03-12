import { stageEmbeddable } from "#internal/entity/metadata/stage-metadata";

/**
 * Mark a class as an embeddable value type.
 *
 * Embeddable classes have no primary key, no table, and no identity.
 * Their fields are flattened into the parent entity's table as real
 * columns with a configurable prefix via `@Embedded()`.
 *
 * - Use `@Field()` decorators on embeddable fields as normal
 * - Do NOT use `@Entity()` or `@PrimaryKey()` on embeddable classes
 */
export const Embeddable =
  () =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageEmbeddable(context.metadata);
  };
