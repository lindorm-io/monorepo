import { isString } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { OneToOneOptions } from "../types";
import { globalEntityMetadata } from "../utils";

export const OneToOne = <E extends IEntity>(
  entityFn: () => Constructor<E>,
  entityKey: keyof E,
  hasJoinKey: boolean = false,
  options: OneToOneOptions<E> = {},
): PropertyDecorator =>
  function OneToOne(target, key) {
    globalEntityMetadata.addRelation({
      target: target.constructor,
      key: key.toString(),
      foreignConstructor: entityFn,
      foreignKey: entityKey.toString(),
      options: {
        joinKey: hasJoinKey && isString(options.joinKey) ? options.joinKey : hasJoinKey,
        joinTable: null,
        loading: options.loading ?? null,
        nullable: options.nullable ?? false,
        onDelete: options.onDelete ?? null,
        onOrphan: options.onOrphan ?? null,
        onUpdate: options.onUpdate ?? null,
        strategy: options.strategy ?? null,
      },
      type: "OneToOne",
    });
  };
