import { isFunction } from "@lindorm/is";
import type { Constructor, Dict } from "@lindorm/types";
import { IEntity } from "../../../interfaces";
import type { MetaFieldDecorator } from "../types/metadata";
import { createEntity } from "./default-create-entity";
import { getEntityMetadata } from "../metadata/get-entity-metadata";
import { isLazyRelation } from "./lazy-relation";
import { isLazyCollection } from "./lazy-collection";
import { parseField } from "./parse-field";

const reset: Array<MetaFieldDecorator> = [
  "CreateDate",
  "ExpiryDate",
  "DeleteDate",
  "UpdateDate",
  "Version",
];

export const defaultCloneEntity = <E extends IEntity>(
  target: Constructor<E>,
  entity: E,
  visited: WeakSet<Dict> = new WeakSet(),
): E => {
  const metadata = getEntityMetadata(target);
  const clone = new target() as any;

  visited.add(clone);

  for (const field of metadata.fields) {
    // Skip embedded fields — they have dotted keys and are handled below
    if (field.embedded) continue;

    if (metadata.generated.some((g) => g.key === field.key)) continue;

    if (
      reset.includes(field.decorator) ||
      metadata.primaryKeys.includes(field.key) ||
      metadata.indexes.some((u) => u.unique && u.keys.some((k) => k.key === field.key)) ||
      metadata.uniques.some((u) => u.keys.length === 1 && u.keys[0] === field.key)
    ) {
      clone[field.key] = undefined;
    } else {
      clone[field.key] = parseField(field, entity);
    }

    if (clone[field.key] !== null && clone[field.key] !== undefined) continue;

    clone[field.key] = isFunction(field.default) ? field.default() : field.default;
  }

  // Deep-clone embedded objects
  const embeddedParents = new Set<string>();
  for (const field of metadata.fields) {
    if (!field.embedded) continue;
    embeddedParents.add(field.embedded.parentKey);
  }
  for (const parentKey of embeddedParents) {
    const source = (entity as any)[parentKey];
    if (source != null) {
      const firstField = metadata.fields.find(
        (f) => f.embedded?.parentKey === parentKey,
      )!;
      const EmbeddableConstructor = firstField.embedded!.constructor();
      const instance = new EmbeddableConstructor();
      for (const [k, v] of Object.entries(source)) {
        instance[k] = v != null && typeof v === "object" ? structuredClone(v) : v;
      }
      clone[parentKey] = instance;
    } else {
      clone[parentKey] = null;
    }
  }

  // Deep-clone @EmbeddedList arrays. A LazyCollection thenable is preserved
  // by identity — cloning an unresolved lazy EL keeps the same deferred-load
  // semantics on the clone.
  for (const el of metadata.embeddedLists ?? []) {
    const source = (entity as any)[el.key];
    if (Array.isArray(source)) {
      clone[el.key] = structuredClone(source);
    } else if (isLazyCollection(source)) {
      clone[el.key] = source;
    } else {
      clone[el.key] = [];
    }
  }

  // Reset generated fields to null so generate() can populate them
  for (const gen of metadata.generated) {
    clone[gen.key] = null;
  }

  for (const relation of metadata.relations) {
    const ForeignConstructor = relation.foreignConstructor();
    const rawRelation = entity[relation.key];

    // Skip unresolved lazy thenables — treat as "not loaded"
    if (isLazyRelation(rawRelation) || isLazyCollection(rawRelation)) {
      const isCol = relation.type === "OneToMany" || relation.type === "ManyToMany";
      clone[relation.key] = isCol ? [] : null;
      continue;
    }

    const relationOptions = rawRelation;

    switch (relation.type) {
      case "OneToOne":
      case "ManyToOne": {
        clone[relation.key] = relationOptions
          ? createEntity(ForeignConstructor, relationOptions, visited)
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
            : createEntity(ForeignConstructor, item, visited);

          clone[relation.key].push(created);

          if (!isExisting) {
            if (relation.type === "ManyToMany") {
              created[relation.foreignKey] = [clone];
            } else {
              created[relation.foreignKey] = clone;

              if (relation.findKeys) {
                for (const [fkCol, pkCol] of Object.entries(relation.findKeys)) {
                  created[fkCol] = clone[pkCol];
                }
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

  return clone as E;
};
