import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../interfaces";
import type { RelationOptions } from "../internal/entity/types/decorators";
import { stageRelation } from "../internal/entity/metadata/stage-metadata";

/**
 * Declare a one-to-many relation (inverse side -- the related entity holds the FK).
 *
 * This entity does not have a FK column. The related entity's ManyToOne
 * side owns the join key.
 *
 * @param entityFn - Thunk returning the related entity constructor.
 * @param entityKey - The property on the related entity that holds the ManyToOne back-reference.
 * @param options.strategy - Relation loading strategy.
 */
export const OneToMany =
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
      joinKeys: null,
      joinTable: null,
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
      type: "OneToMany",
    });
  };
