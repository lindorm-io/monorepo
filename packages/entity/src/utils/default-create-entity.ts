import { isFunction, isObject } from "@lindorm/is";
import { Constructor, DeepPartial, Dict } from "@lindorm/types";
import { IEntity } from "../interfaces";
import { globalEntityMetadata } from "./global";
import { parseColumn } from "./private";

export const createEntity = <
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
>(
  target: Constructor<E>,
  options: O | E = {} as O,
  visited: WeakSet<Dict>,
): E => {
  if (isObject(options) && visited.has(options)) {
    return options as E;
  }

  if (isObject(options)) {
    visited.add(options);
  }

  const metadata = globalEntityMetadata.get(target);
  const entity = new target() as any;

  for (const column of metadata.columns) {
    entity[column.key] = parseColumn(column, entity, options);

    if (entity[column.key]) continue;

    entity[column.key] = isFunction(column.fallback)
      ? column.fallback()
      : column.fallback;
  }

  for (const relation of metadata.relations) {
    const ForeignConstructor = relation.foreignConstructor();

    // add relation join keys
    switch (relation.type) {
      case "ManyToOne":
      case "OneToOne":
        if (isObject(relation.joinKeys)) {
          for (const key of Object.keys(relation.joinKeys)) {
            entity[key] = options[key] ?? null;
          }
        }
        break;

      default:
        break;
    }

    const data = options[relation.key];

    // add relations
    switch (relation.type) {
      case "ManyToMany":
      case "OneToMany": {
        entity[relation.key] = [];

        for (const item of data ?? []) {
          const isExisting = item instanceof ForeignConstructor;
          const created = isExisting
            ? item
            : createEntity(ForeignConstructor, item, visited);

          entity[relation.key].push(created);

          if (!isExisting) {
            if (relation.type === "ManyToMany") {
              created[relation.foreignKey] = [entity];
            } else {
              created[relation.foreignKey] = entity;

              if (relation.findKeys) {
                for (const [fkCol, pkCol] of Object.entries(relation.findKeys)) {
                  created[fkCol] = entity[pkCol];
                }
              }
            }
          }
        }

        break;
      }

      case "ManyToOne":
      case "OneToOne": {
        const isExisting = data instanceof ForeignConstructor;

        entity[relation.key] = isExisting
          ? data
          : data
            ? createEntity(ForeignConstructor, data, visited)
            : null;

        if (entity[relation.key] && !isExisting && !relation.joinKeys) {
          entity[relation.key][relation.foreignKey] = entity;

          if (relation.findKeys) {
            for (const [fkCol, pkCol] of Object.entries(relation.findKeys)) {
              entity[relation.key][fkCol] = entity[pkCol];
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
    hook.callback(entity);
  }

  return entity as E;
};

export const defaultCreateEntity = <
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
>(
  target: Constructor<E>,
  options: O | E = {} as O,
): E => createEntity(target, options, new WeakSet());
