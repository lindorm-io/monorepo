import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import { defaultHydrateEntity } from "../../../../entity/utils/default-hydrate-entity.js";
import type { HydrateOptions } from "../../../../entity/utils/default-hydrate-entity.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import type { AliasMap } from "./compile-select.js";
import { extractFieldDictFromAliased } from "./extract-field-dict.js";
import { getRelationMetadata } from "./get-relation-metadata.js";

type IncludeInfo = {
  inc: IncludeSpec;
  relation: EntityMetadata["relations"][number];
  foreignMeta: EntityMetadata;
  targetAlias: AliasMap;
};

/**
 * Resolve the correct metadata for a row based on the discriminator column value.
 */
const resolvePolymorphicMetadataFromAliased = (
  row: Dict,
  rootMetadata: EntityMetadata,
  tableAlias: string,
): EntityMetadata => {
  const inh = rootMetadata.inheritance;
  if (!inh) return rootMetadata;
  if (inh.discriminatorValue != null) return rootMetadata;
  if (inh.children.size === 0) return rootMetadata;

  const discAlias = `${tableAlias}_${inh.discriminatorField}`;
  const discValue = row[discAlias];

  if (discValue == null) return rootMetadata;

  const childConstructor = inh.children.get(discValue);
  if (!childConstructor) return rootMetadata;

  return getEntityMetadata(childConstructor);
};

export const hydrateRows = <E extends IEntity>(
  rows: Array<Dict>,
  metadata: EntityMetadata,
  aliasMap: Array<AliasMap>,
  includes: Array<IncludeSpec>,
  options?: HydrateOptions,
): Array<E> => {
  if (rows.length === 0) return [];

  // When there are no includes, hydration is straightforward
  if (includes.length === 0) {
    return rows.map((row) => {
      const effectiveMeta = resolvePolymorphicMetadataFromAliased(row, metadata, "t0");
      const dict = extractFieldDictFromAliased(row, effectiveMeta, "t0");
      return defaultHydrateEntity<E>(dict, effectiveMeta, options);
    });
  }

  // Precompute relation metadata outside the row loop
  const includeInfos: Array<IncludeInfo> = [];
  for (const inc of includes) {
    const relation = metadata.relations.find((r) => r.key === inc.relation);
    if (!relation) continue;
    const foreignMeta = getRelationMetadata(relation);
    const targetAlias = aliasMap.find((a) => a.relationKey === inc.relation);
    if (!targetAlias) continue;
    includeInfos.push({ inc, relation, foreignMeta, targetAlias });
  }

  // With includes, group rows by root entity PK and aggregate included relations
  const pkKeys = metadata.primaryKeys;
  const entityMap = new Map<
    string,
    { root: E; relations: Map<string, Array<unknown>>; seen: Map<string, Set<string>> }
  >();

  for (const row of rows) {
    const pkValue =
      pkKeys.length === 1
        ? String(row[`t0_${pkKeys[0]}`] ?? "")
        : JSON.stringify(pkKeys.map((pk) => row[`t0_${pk}`] ?? null));

    if (!entityMap.has(pkValue)) {
      const effectiveMeta = resolvePolymorphicMetadataFromAliased(row, metadata, "t0");
      const dict = extractFieldDictFromAliased(row, effectiveMeta, "t0");
      const root = defaultHydrateEntity<E>(dict, effectiveMeta, options);
      entityMap.set(pkValue, { root, relations: new Map(), seen: new Map() });
    }

    const entry = entityMap.get(pkValue)!;

    // Hydrate each included relation
    for (const { inc, foreignMeta, targetAlias } of includeInfos) {
      const foreignPks = foreignMeta.primaryKeys;
      const hasData = foreignPks.some((pk) => {
        const alias = `${targetAlias.tableAlias}_${pk}`;
        return row[alias] != null;
      });

      if (!hasData) continue;

      const effectiveForeignMeta = resolvePolymorphicMetadataFromAliased(
        row,
        foreignMeta,
        targetAlias.tableAlias,
      );

      const foreignFields = inc.select
        ? effectiveForeignMeta.fields.filter(
            (f) =>
              inc.select!.includes(f.key) ||
              effectiveForeignMeta.primaryKeys.includes(f.key),
          )
        : effectiveForeignMeta.fields;

      const restrictedMeta = inc.select
        ? { ...effectiveForeignMeta, fields: foreignFields }
        : effectiveForeignMeta;

      const dict = extractFieldDictFromAliased(
        row,
        restrictedMeta,
        targetAlias.tableAlias,
      );
      const foreignEntity = defaultHydrateEntity(dict, restrictedMeta, {
        snapshot: options?.snapshot ?? false,
        hooks: false,
        amphora: options?.amphora,
      });

      if (!entry.relations.has(inc.relation)) {
        entry.relations.set(inc.relation, []);
        entry.seen.set(inc.relation, new Set());
      }

      const foreignPkValue =
        foreignPks.length === 1
          ? String(row[`${targetAlias.tableAlias}_${foreignPks[0]}`] ?? "")
          : JSON.stringify(
              foreignPks.map((pk) => row[`${targetAlias.tableAlias}_${pk}`] ?? null),
            );

      const seenSet = entry.seen.get(inc.relation)!;
      if (!seenSet.has(foreignPkValue)) {
        seenSet.add(foreignPkValue);
        entry.relations.get(inc.relation)!.push(foreignEntity);
      }
    }
  }

  // Assemble final results
  return Array.from(entityMap.values()).map(({ root, relations }) => {
    for (const { inc, relation } of includeInfos) {
      const isCollection =
        relation.type === "OneToMany" || relation.type === "ManyToMany";
      let items = relations.get(inc.relation) ?? [];

      if (isCollection && relation.orderBy && items.length > 1) {
        items = sortByOrderBy(items, relation.orderBy);
      }

      (root as any)[inc.relation] = isCollection ? items : (items[0] ?? null);
    }
    return root;
  });
};

const sortByOrderBy = (
  items: Array<unknown>,
  orderBy: Record<string, "ASC" | "DESC">,
): Array<unknown> => {
  const entries = Object.entries(orderBy);
  return [...items].sort((a, b) => {
    for (const [key, dir] of entries) {
      const aVal = (a as any)[key];
      const bVal = (b as any)[key];
      if (aVal === bVal) continue;
      if (aVal == null) return dir === "ASC" ? 1 : -1;
      if (bVal == null) return dir === "ASC" ? -1 : 1;
      const cmp = aVal < bVal ? -1 : 1;
      return dir === "ASC" ? cmp : -cmp;
    }
    return 0;
  });
};
