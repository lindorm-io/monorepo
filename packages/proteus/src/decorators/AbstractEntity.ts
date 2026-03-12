import { stageAbstractEntity } from "#internal/entity/metadata/stage-metadata";

/**
 * Mark a class as an abstract entity (mapped superclass).
 *
 * Abstract entities are NOT registered as concrete tables. Instead, their
 * fields, hooks, and other metadata are inherited by concrete `@Entity()`
 * subclasses via `Symbol.metadata` prototype chain.
 *
 * - `@AbstractEntity()` on a base class
 * - `@Entity()` on a subclass that extends it
 *
 * Attempting to use an abstract entity directly (e.g. building metadata
 * for it or registering it as a table) will throw.
 */
export const AbstractEntity =
  () =>
  (_target: Function, context: ClassDecoratorContext): void => {
    stageAbstractEntity(context.metadata);
  };
