import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../interfaces";
import type { RelationOptions } from "../internal/entity/types/decorators";
import { stageRelation } from "../internal/entity/metadata/stage-metadata";

/**
 * Declare a many-to-many relation using a join table.
 *
 * Use `@JoinTable()` on the owning side to mark join table ownership.
 *
 * @param entityFn - Thunk returning the related entity constructor.
 * @param entityKey - The property on the related entity that holds the inverse ManyToMany collection.
 * @param options.strategy - Relation loading strategy.
 */
export const ManyToMany =
  <F extends IEntity>(
    entityFn: () => Constructor<F>,
    entityKey: keyof F,
    options: RelationOptions = {},
  ) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageRelation(context.metadata, {
      key: String(context.name),
      findKeys: null,
      foreignConstructor: entityFn,
      foreignKey: entityKey.toString(),
      joinKeys: true,
      joinTable: false,
      options: {
        deferrable: false,
        initiallyDeferred: false,
        loading: { single: "ignore", multiple: "ignore" },
        nullable: false,
        onDestroy: "ignore",
        onInsert: "ignore",
        onOrphan: "ignore",
        onSoftDestroy: "ignore",
        onUpdate: "ignore",
        strategy: options.strategy ?? null,
      },
      type: "ManyToMany",
    });
  };
