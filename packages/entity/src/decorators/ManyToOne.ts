import { isObject } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { ManyToOneOptions, TypedPropertyDecorator } from "../types";
import { globalEntityMetadata } from "../utils";

export const ManyToOne = <T extends IEntity, F extends IEntity>(
  entityFn: () => Constructor<F>,
  entityKey: keyof F,
  options: ManyToOneOptions<T, F> = {},
): TypedPropertyDecorator<T> =>
  function ManyToOne(target, key) {
    globalEntityMetadata.addRelation({
      target: target.constructor,
      key: key.toString(),
      findKeys: null,
      foreignConstructor: entityFn,
      foreignKey: entityKey.toString(),
      joinKeys: isObject(options.joinKeys) ? options.joinKeys : true,
      joinTable: null,
      options: {
        loading: options.loading ?? "ignore",
        nullable: options.nullable ?? false,
        onDestroy: options.onDestroy ?? "ignore",
        onInsert: options.onInsert ?? "ignore",
        onOrphan: options.onOrphan ?? "ignore",
        onUpdate: options.onUpdate ?? "ignore",
        strategy: options.strategy ?? null,
      },
      type: "ManyToOne",
    });
  };
