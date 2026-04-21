import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../interfaces/index.js";
import type { RelationOptions } from "../internal/entity/types/decorators.js";
import { stageRelation } from "../internal/entity/metadata/stage-metadata.js";

/**
 * Declare a many-to-one relation (this entity holds the FK).
 *
 * The owning side -- this entity's table gets the foreign key column(s).
 * Use `@Nullable()` on the FK field to allow NULL values.
 * Use `@Deferrable()` for deferred FK constraints.
 * Use `@JoinKey({ localCol: "foreignCol" })` for explicit FK mapping.
 *
 * @param entityFn - Thunk returning the related entity constructor.
 * @param entityKey - The property on the related entity that holds the inverse OneToMany collection.
 * @param options.strategy - Relation loading strategy.
 */
export const ManyToOne =
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
      type: "ManyToOne",
    });
  };
