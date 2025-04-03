import { isString } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { ManyToOneOptions } from "../types";
import { globalEntityMetadata } from "../utils";

export const ManyToOne = <E extends IEntity>(
  entityFn: () => Constructor<E>,
  entityKey: keyof E,
  options: ManyToOneOptions<E> = {},
): PropertyDecorator =>
  function ManyToOne(target, key) {
    globalEntityMetadata.addRelation({
      target: target.constructor,
      key: key.toString(),
      foreignConstructor: entityFn,
      foreignKey: entityKey.toString(),
      options: {
        joinKey: isString(options.joinKey) ? options.joinKey : true,
        joinTable: null,
        loading: options.loading ?? null,
        nullable: false,
        onDelete: options.onDelete ?? null,
        onOrphan: options.onOrphan ?? null,
        onUpdate: options.onUpdate ?? null,
        strategy: options.strategy ?? null,
      },
      type: "ManyToOne",
    });
  };
