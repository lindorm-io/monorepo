import { isFunction, isObject } from "@lindorm/is";
import type { Constructor, DeepPartial, Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import { getEntityMetadata } from "../metadata/get-entity-metadata.js";
import { isLazyRelation } from "./lazy-relation.js";
import { isLazyCollection } from "./lazy-collection.js";
import { parseField } from "./parse-field.js";

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

  const metadata = getEntityMetadata(target);
  const entity = new target() as any;

  for (const field of metadata.fields) {
    // Skip embedded fields — they have dotted keys and are handled below
    if (field.embedded) continue;

    entity[field.key] = parseField(field, entity, options);

    if (entity[field.key] !== null && entity[field.key] !== undefined) continue;

    entity[field.key] = isFunction(field.default) ? field.default() : field.default;
  }

  // Initialize embedded objects from options
  const embeddedParents = new Set<string>();
  for (const field of metadata.fields) {
    if (!field.embedded) continue;
    embeddedParents.add(field.embedded.parentKey);
  }
  for (const parentKey of embeddedParents) {
    const optValue = (options as any)[parentKey];
    if (optValue != null && isObject(optValue)) {
      // Get the constructor from the first embedded field for this parent
      const firstField = metadata.fields.find(
        (f) => f.embedded?.parentKey === parentKey,
      )!;
      const EmbeddableConstructor = firstField.embedded!.constructor();
      const instance = new EmbeddableConstructor();
      for (const [k, v] of Object.entries(optValue)) {
        instance[k] = v;
      }
      entity[parentKey] = instance;
    } else {
      entity[parentKey] = optValue ?? null;
    }
  }

  // Initialize @EmbeddedList fields from options.
  // - Populated Array<T>: copy by value
  // - LazyCollection thenable: preserve identity (cloning a lazy collection
  //   keeps the same deferred-load semantics on the new entity)
  // - Otherwise: default to empty array for eager-by-default consistency
  for (const el of metadata.embeddedLists ?? []) {
    const optValue = (options as any)[el.key];
    if (Array.isArray(optValue)) {
      entity[el.key] = [...optValue];
    } else if (isLazyCollection(optValue)) {
      entity[el.key] = optValue;
    } else {
      entity[el.key] = [];
    }
  }

  // Reset generated fields that weren't user-provided to null.
  // deserialise zero-coerces some types (integer→0, float→0, bigint→0n, etc.)
  // which would cause defaultGenerateEntity to skip them.
  for (const gen of metadata.generated) {
    if ((options as any)[gen.key] != null) continue;
    entity[gen.key] = null;
  }

  for (const relation of metadata.relations) {
    const ForeignConstructor = relation.foreignConstructor();

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

    const rawData = options[relation.key];

    // Skip unresolved lazy thenables — treat as "not loaded"
    if (isLazyRelation(rawData) || isLazyCollection(rawData)) {
      const isCol = relation.type === "OneToMany" || relation.type === "ManyToMany";
      entity[relation.key] = isCol ? [] : null;
      continue;
    }

    const data = rawData;

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

  return entity as E;
};

export const defaultCreateEntity = <
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
>(
  target: Constructor<E>,
  options: O | E = {} as O,
): E => createEntity(target, options, new WeakSet());
