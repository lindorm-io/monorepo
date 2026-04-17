import { stageJoinTable } from "../internal/entity/metadata/stage-metadata";

/**
 * Options for explicit join table configuration.
 */
export type JoinTableOptions = {
  /** Custom name for the join table. Defaults to an auto-generated alphabetically-sorted name. */
  name?: string;
};

/**
 * Explicitly configure the join table for a ManyToMany relation.
 *
 * Place on the owning side of the ManyToMany relation alongside the
 * `@ManyToMany` decorator. Only one side should have `@JoinTable`.
 */
export const JoinTable =
  (options: JoinTableOptions = {}) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageJoinTable(context.metadata, {
      key: String(context.name),
      name: options.name,
    });
  };
