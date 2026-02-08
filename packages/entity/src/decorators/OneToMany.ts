import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { OneToManyOptions, TypedPropertyDecorator } from "../types";
import { globalEntityMetadata } from "../utils";

export const OneToMany = <T extends IEntity, F extends IEntity>(
  entityFn: () => Constructor<F>,
  entityKey: keyof F,
  options: OneToManyOptions = {},
): TypedPropertyDecorator<T> =>
  function OneToMany(target, key) {
    globalEntityMetadata.addRelation({
      target: target.constructor,
      key: key.toString(),
      findKeys: null,
      foreignConstructor: entityFn,
      foreignKey: entityKey.toString(),
      joinKeys: null,
      joinTable: null,
      options: {
        loading: options.loading ?? "ignore",
        nullable: false,
        onDestroy: options.onDestroy ?? "ignore",
        onInsert: options.onInsert ?? "ignore",
        onOrphan: options.onOrphan ?? "ignore",
        onUpdate: options.onUpdate ?? "ignore",
        strategy: options.strategy ?? null,
      },
      type: "OneToMany",
    });
  };
