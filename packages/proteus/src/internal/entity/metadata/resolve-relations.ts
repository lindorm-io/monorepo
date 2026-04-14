import { camelCase, snakeCase } from "@lindorm/case";
import { isArray, isObject, isString, isTrue } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { EntityMetadataError } from "../errors/EntityMetadataError";
import type { EntityMetadata, MetaRelation } from "../types/metadata";
import type {
  StagedJoinField,
  StagedJoinTable,
  StagedRelation,
  StagedRelationModifier,
} from "../types/staged";
import { calculateJoinKeys } from "../utils/calculate-join-keys";
import { reverseDictValues } from "../utils/reverse-dict-values";
import { buildPrimaryMetadata } from "./build-primary";
import { collectAll } from "./collect";

const mergeJoinFields = (
  targetName: string,
  staged: Array<StagedRelation>,
  joinFields: Array<StagedJoinField>,
): void => {
  for (const jf of joinFields) {
    const relation = staged.find((r) => r.key === jf.key);
    if (!relation) {
      throw new EntityMetadataError(
        `@JoinKey on property "${jf.key}" requires a relation decorator`,
        { debug: { target: targetName, property: jf.key } },
      );
    }

    relation.joinKeys = jf.joinKeys;
  }
};

const mergeJoinTables = (
  targetName: string,
  staged: Array<StagedRelation>,
  joinTables: Array<StagedJoinTable>,
): void => {
  for (const jt of joinTables) {
    const relation = staged.find((r) => r.key === jt.key);
    if (!relation) {
      throw new EntityMetadataError(
        `@JoinTable on property "${jt.key}" requires a relation decorator`,
        { debug: { target: targetName, property: jt.key } },
      );
    }

    if (relation.type !== "ManyToMany") {
      throw new EntityMetadataError(
        `@JoinTable on "${jt.key}" is only valid on @ManyToMany relations`,
        { debug: { target: targetName, property: jt.key } },
      );
    }

    // Error if both inline joinTable AND @JoinTable present
    if (isString(relation.joinTable)) {
      throw new EntityMetadataError(
        `@JoinTable on "${jt.key}" conflicts with inline joinTable on the relation decorator`,
        { debug: { target: targetName, property: jt.key } },
      );
    }

    relation.joinTable = jt.name ?? true;
  }
};

const mergeRelationModifiers = (
  targetName: string,
  staged: Array<StagedRelation>,
  modifiers: Array<StagedRelationModifier>,
  orderByMap: Map<string, Record<string, "ASC" | "DESC">>,
  embeddedListKeys: Set<string>,
): void => {
  // Track applied decorators per key per scope
  // Outer key = property name, inner key = scope ("single" | "multiple" | "both"), value = set of decorator names
  const applied = new Map<string, Map<string, Set<string>>>();

  for (const modifier of modifiers) {
    const relation = staged.find((r) => r.key === modifier.key);
    if (!relation) {
      // Fall-through: @Eager / @Lazy are allowed on @EmbeddedList targets.
      // The other four relation modifier decorators (Cascade, OnOrphan,
      // Deferrable, OrderBy) remain relation-only and still throw.
      if (embeddedListKeys.has(modifier.key)) {
        const isLoadingOnly =
          modifier.loading != null &&
          modifier.cascade == null &&
          modifier.deferrable == null &&
          modifier.initiallyDeferred == null &&
          modifier.onOrphan == null &&
          modifier.orderBy == null;
        if (isLoadingOnly) continue; // handled by resolveEmbeddedListLoading
      }
      throw new EntityMetadataError(
        `@${modifier.decorator} on property "${modifier.key}" requires a relation decorator`,
        { debug: { target: targetName, property: modifier.key } },
      );
    }

    const key = modifier.key;
    if (!applied.has(key)) applied.set(key, new Map());
    const scopeMap = applied.get(key)!;

    // Determine the effective scope key and base decorator name
    const scopeKey = modifier.loadingScope ?? "both";
    const baseName =
      modifier.loading === "eager"
        ? "Eager"
        : modifier.loading === "lazy"
          ? "Lazy"
          : null;

    // Duplicate detection (same decorator with same scope)
    if (!scopeMap.has(scopeKey)) scopeMap.set(scopeKey, new Set());
    const decoratorsForScope = scopeMap.get(scopeKey)!;

    if (decoratorsForScope.has(modifier.decorator)) {
      throw new EntityMetadataError(
        `Duplicate @${modifier.decorator} on property "${key}" of ${targetName}`,
        { debug: { target: targetName, property: key, decorator: modifier.decorator } },
      );
    }

    // Conflict detection: Eager vs Lazy on overlapping scopes
    if (baseName) {
      const opposite = baseName === "Eager" ? "Lazy" : "Eager";
      const scopesToCheck =
        scopeKey === "both" ? ["both", "single", "multiple"] : ["both", scopeKey];

      for (const checkScope of scopesToCheck) {
        const existing = scopeMap.get(checkScope);
        if (!existing) continue;
        for (const dec of existing) {
          if (dec.startsWith(opposite)) {
            throw new EntityMetadataError(
              `@Eager and @Lazy conflict on property "${key}" of ${targetName} (overlapping scope)`,
              { debug: { target: targetName, property: key } },
            );
          }
        }
      }
    }

    decoratorsForScope.add(modifier.decorator);

    // Apply loading
    if (modifier.loading) {
      if (modifier.loadingScope) {
        relation.options.loading[modifier.loadingScope] = modifier.loading;
      } else {
        relation.options.loading.single = modifier.loading;
        relation.options.loading.multiple = modifier.loading;
      }
    }

    // Apply cascade
    if (modifier.cascade) {
      if (modifier.cascade.onInsert)
        relation.options.onInsert = modifier.cascade.onInsert;
      if (modifier.cascade.onUpdate)
        relation.options.onUpdate = modifier.cascade.onUpdate;
      if (modifier.cascade.onDestroy)
        relation.options.onDestroy = modifier.cascade.onDestroy;
      if (modifier.cascade.onSoftDestroy)
        relation.options.onSoftDestroy = modifier.cascade.onSoftDestroy;
    }

    // Apply deferrable
    if (modifier.deferrable != null) {
      relation.options.deferrable = modifier.deferrable;
    }
    if (modifier.initiallyDeferred != null) {
      relation.options.initiallyDeferred = modifier.initiallyDeferred;
    }

    // Apply orphan strategy
    if (modifier.onOrphan) {
      relation.options.onOrphan = modifier.onOrphan;
    }

    // Apply orderBy
    if (modifier.orderBy) {
      orderByMap.set(key, modifier.orderBy);
    }
  }
};

const resolveRelation = (
  staged: StagedRelation,
  primaryMeta: Omit<EntityMetadata, "relations">,
  orderByMap: Map<string, Record<string, "ASC" | "DESC">>,
): MetaRelation => {
  const targetName = primaryMeta.target.name;
  const foreignMeta = buildPrimaryMetadata(staged.foreignConstructor());

  const foreign = collectAll(staged.foreignConstructor(), "relations").find(
    (r) => r.key === staged.foreignKey && r.foreignKey === staged.key,
  );

  if (!foreign) {
    throw new EntityMetadataError("Foreign relation metadata not found", {
      debug: { target: targetName, relation: staged.key },
    });
  }

  // Merge @JoinKey from the foreign entity into the foreign relation (raw staged
  // data does not include joinField merges yet)
  const foreignJoinFields = collectAll(staged.foreignConstructor(), "joinFields");
  const foreignJf = foreignJoinFields.find((jf) => jf.key === staged.foreignKey);
  if (foreignJf) {
    foreign.joinKeys = foreignJf.joinKeys;
  }

  if (!staged.joinKeys && !foreign.joinKeys) {
    throw new EntityMetadataError("Join keys not found", {
      debug: { target: targetName, relation: staged.key },
    });
  }

  if (isObject(staged.joinKeys)) {
    for (const key of Object.keys(staged.joinKeys)) {
      const field = primaryMeta.fields.find((f) => f.key === key);
      if (field) continue;
      throw new EntityMetadataError("Join key field not found", {
        debug: { target: targetName, relation: staged.key, key },
      });
    }

    for (const key of Object.values(staged.joinKeys)) {
      const field = foreignMeta.fields.find((f) => f.key === key);
      if (field) continue;
      throw new EntityMetadataError("Foreign join key field not found", {
        debug: { target: targetName, relation: staged.key, key },
      });
    }
  }

  if (isArray(staged.joinKeys)) {
    for (const key of staged.joinKeys) {
      const field = primaryMeta.fields.find((f) => f.key === key);
      if (field) continue;
      throw new EntityMetadataError("Join key field not found", {
        debug: { target: targetName, relation: staged.key, key },
      });
    }
  }

  let joinKeys: Dict<string> | null = null;
  let findKeys: Dict<string> | null = null;
  let joinTable: string | null = null;

  switch (staged.type) {
    case "ManyToMany": {
      // Check if the foreign entity has a @JoinTable staged for the inverse relation
      const foreignJoinTables = collectAll(staged.foreignConstructor(), "joinTables");
      const foreignJt = foreignJoinTables.find((jt) => jt.key === staged.foreignKey);

      // Merge foreign @JoinTable into the foreign staged relation
      if (foreignJt && !foreign.joinTable) {
        foreign.joinTable = foreignJt.name ?? true;
      }

      if (!staged.joinTable && !foreign.joinTable) {
        throw new EntityMetadataError("Join table not found", {
          debug: { target: targetName, relation: staged.key },
        });
      }

      const wasOwner = isTrue(staged.joinTable);

      if (isArray<string>(staged.joinKeys)) {
        joinKeys = staged.joinKeys.reduce(
          (acc, key) => ({
            ...acc,
            [camelCase(`${primaryMeta.entity.name}_${key}`)]: key,
          }),
          {} as Dict<string>,
        );
      } else if (primaryMeta.target === foreignMeta.target) {
        const selfJoinKeys: Dict<string> = {};
        for (const key of primaryMeta.primaryKeys) {
          const entityName = primaryMeta.entity.name;
          selfJoinKeys[camelCase(`source_${entityName}_${key}`)] = key;
          selfJoinKeys[camelCase(`target_${entityName}_${key}`)] = key;
        }
        joinKeys = selfJoinKeys;
      } else {
        joinKeys = primaryMeta.primaryKeys.reduce(
          (acc, key) => ({
            ...acc,
            [camelCase(`${primaryMeta.entity.name}_${key}`)]: key,
          }),
          {} as Dict<string>,
        );
      }

      if (isString(staged.joinTable) || isString(foreign.joinTable)) {
        joinTable = (staged.joinTable as string) || (foreign.joinTable as string);
      } else if (isTrue(staged.joinTable) || isTrue(foreign.joinTable)) {
        const [a, b] = [primaryMeta.entity.name, foreignMeta.entity.name].sort();
        joinTable = snakeCase(`${a}_x_${b}`);
      }

      if (primaryMeta.target === foreignMeta.target) {
        const side = wasOwner ? "source" : "target";
        const selfFindKeys: Dict<string> = {};
        for (const key of primaryMeta.primaryKeys) {
          const entityName = primaryMeta.entity.name;
          selfFindKeys[camelCase(`${side}_${entityName}_${key}`)] = key;
        }
        findKeys = selfFindKeys;
      } else {
        findKeys = joinKeys;
      }
      break;
    }

    case "ManyToOne":
      if (isTrue(staged.joinKeys)) {
        joinKeys = calculateJoinKeys(staged, foreignMeta);
      } else if (isObject(staged.joinKeys)) {
        joinKeys = staged.joinKeys as Dict<string>;
      }
      if (joinKeys) {
        findKeys = reverseDictValues(joinKeys);
      } else {
        findKeys = reverseDictValues(calculateJoinKeys(staged, foreignMeta));
      }
      break;

    case "OneToMany":
      if (isObject(foreign.joinKeys)) {
        findKeys = foreign.joinKeys as Dict<string>;
      } else {
        findKeys = calculateJoinKeys(foreign, primaryMeta);
      }
      break;

    case "OneToOne":
      if (staged.joinKeys && foreign.joinKeys) {
        throw new EntityMetadataError("Join keys cannot be set on both decorators", {
          debug: { target: targetName, relation: staged.key },
        });
      }
      if (isTrue(staged.joinKeys)) {
        joinKeys = calculateJoinKeys(staged, foreignMeta);
      } else if (isObject(staged.joinKeys)) {
        joinKeys = staged.joinKeys as Dict<string>;
      }
      if (joinKeys) {
        findKeys = reverseDictValues(joinKeys);
      } else if (isObject(foreign.joinKeys)) {
        findKeys = foreign.joinKeys as Dict<string>;
      } else if (isTrue(foreign.joinKeys)) {
        findKeys = calculateJoinKeys(foreign, primaryMeta);
      }
      break;
  }

  if (!findKeys) {
    throw new EntityMetadataError("Unable to calculate find keys for relation", {
      debug: { target: targetName, relation: staged.key },
    });
  }

  return {
    key: staged.key,
    foreignConstructor: staged.foreignConstructor,
    foreignKey: staged.foreignKey,
    findKeys,
    joinKeys,
    joinTable,
    options: staged.options,
    orderBy: orderByMap.get(staged.key) ?? null,
    type: staged.type,
  };
};

export const resolveRelations = (
  target: Function,
  primaryMeta: Omit<EntityMetadata, "relations">,
): Array<MetaRelation> => {
  const targetName = primaryMeta.target.name;
  const staged = collectAll(target, "relations").map((r) => ({
    ...r,
    options: { ...r.options, loading: { ...r.options.loading } },
  }));
  const joinFields = collectAll(target, "joinFields");
  const joinTables = collectAll(target, "joinTables");
  const relationModifiers = collectAll(target, "relationModifiers");

  // Merge decorator-staged join fields/tables/modifiers into staged relations
  mergeJoinFields(targetName, staged, joinFields);
  mergeJoinTables(targetName, staged, joinTables);

  const orderByMap = new Map<string, Record<string, "ASC" | "DESC">>();
  const embeddedListKeys = new Set(primaryMeta.embeddedLists.map((el) => el.key));
  mergeRelationModifiers(
    targetName,
    staged,
    relationModifiers,
    orderByMap,
    embeddedListKeys,
  );

  const relations: Array<MetaRelation> = [];

  for (const relation of staged) {
    relations.push(resolveRelation(relation, primaryMeta, orderByMap));
  }

  return relations;
};
