import { isFunction } from "@lindorm/is";
import { Constructor } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { MetaColumnDecorator } from "../types";
import { defaultCreateEntity } from "./default-create-entity";
import { globalEntityMetadata } from "./global";
import { parseColumn } from "./private";

const reset: Array<MetaColumnDecorator> = [
  "CreateDateColumn",
  "ExpiryDateColumn",
  "DeleteDateColumn",
  "UpdateDateColumn",
  "VersionColumn",
];

export const defaultCloneEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
): E => {
  const metadata = globalEntityMetadata.get(target);
  const clone = new target() as any;

  for (const column of metadata.columns) {
    if (metadata.generated.some((g) => g.key === column.key)) continue;

    if (
      reset.includes(column.decorator) ||
      metadata.primaryKeys.includes(column.key) ||
      metadata.indexes.some((u) => u.unique && u.keys.every((k) => k.key === column.key))
    ) {
      clone[column.key] = undefined;
    } else {
      clone[column.key] = parseColumn(column, entity);
    }

    if (clone[column.key]) continue;

    clone[column.key] = isFunction(column.fallback) ? column.fallback() : column.fallback;
  }

  for (const relation of metadata.relations) {
    const ForeignConstructor = relation.foreignConstructor();
    const relationOptions = entity[relation.key];

    switch (relation.type) {
      case "OneToOne":
      case "ManyToOne": {
        clone[relation.key] = relationOptions
          ? defaultCreateEntity(ForeignConstructor, relationOptions)
          : null;

        if (clone[relation.key] && !relation.joinKeys) {
          clone[relation.key][relation.foreignKey] = clone;

          if (relation.findKeys) {
            for (const [fkCol, pkCol] of Object.entries(relation.findKeys)) {
              clone[relation.key][fkCol] = clone[pkCol];
            }
          }
        }

        break;
      }

      case "OneToMany":
      case "ManyToMany": {
        clone[relation.key] = [];

        for (const item of relationOptions ?? []) {
          const isExisting = item instanceof ForeignConstructor;
          const created = isExisting
            ? item
            : defaultCreateEntity(ForeignConstructor, item);

          clone[relation.key].push(created);

          if (!isExisting) {
            created[relation.foreignKey] = clone;

            if (relation.findKeys) {
              for (const [fkCol, pkCol] of Object.entries(relation.findKeys)) {
                created[fkCol] = clone[pkCol];
              }
            }
          }
        }

        break;
      }

      default:
        break;
    }
  }

  const hooks = metadata.hooks.filter((h) => h.decorator === "OnCreate");

  for (const hook of hooks) {
    hook.callback(clone);
  }

  return clone as E;
};
