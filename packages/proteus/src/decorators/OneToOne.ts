import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../interfaces";
import type { RelationOptions } from "../internal/entity/types/decorators";
import { stageRelation } from "../internal/entity/metadata/stage-metadata";

/**
 * Declare a one-to-one relation between two entities.
 *
 * Use `@JoinKey()` on the owning side to mark FK ownership.
 * Use `@Nullable()` on the FK field to allow NULL values.
 * Use `@Deferrable()` for deferred FK constraints.
 *
 * @param entityFn - Thunk returning the related entity constructor (avoids circular imports).
 * @param entityKey - The property on the related entity that points back to this entity.
 * @param options.strategy - Relation loading strategy.
 */
export const OneToOne =
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
      joinKeys: false,
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
      type: "OneToOne",
    });
  };
