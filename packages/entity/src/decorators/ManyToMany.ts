import { isString } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { ManyToManyOptions } from "../types";
import { globalEntityMetadata } from "../utils";

export const ManyToMany = <E extends IEntity>(
  entityFn: () => Constructor<E>,
  entityKey: keyof E,
  hasJoinTable: boolean = false,
  options: ManyToManyOptions<E> = {},
): PropertyDecorator =>
  function ManyToMany(target, key) {
    globalEntityMetadata.addRelation({
      target: target.constructor,
      key: key.toString(),
      foreignConstructor: entityFn,
      foreignKey: entityKey.toString(),
      options: {
        joinKey: null,
        joinTable:
          hasJoinTable && isString(options.joinTable) ? options.joinTable : hasJoinTable,
        loading: options.loading ?? null,
        nullable: false,
        onDelete: options.onDelete ?? null,
        onOrphan: options.onOrphan ?? null,
        onUpdate: options.onUpdate ?? null,
        strategy: options.strategy ?? null,
      },
      type: "ManyToMany",
    });
  };
