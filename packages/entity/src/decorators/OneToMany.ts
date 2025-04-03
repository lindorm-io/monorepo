import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { OneToManyOptions } from "../types";
import { globalEntityMetadata } from "../utils";

export const OneToMany = <E extends IEntity>(
  entityFn: () => Constructor<E>,
  entityKey: keyof E,
  options: OneToManyOptions = {},
): PropertyDecorator =>
  function OneToMany(target, key) {
    globalEntityMetadata.addRelation({
      target: target.constructor,
      key: key.toString(),
      foreignConstructor: entityFn,
      foreignKey: entityKey.toString(),
      options: {
        joinKey: null,
        joinTable: null,
        loading: options.loading ?? null,
        nullable: false,
        onDelete: options.onDelete ?? null,
        onOrphan: options.onOrphan ?? null,
        onUpdate: options.onUpdate ?? null,
        strategy: options.strategy ?? null,
      },
      type: "OneToMany",
    });
  };
