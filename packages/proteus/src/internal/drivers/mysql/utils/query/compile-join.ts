import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import { ProteusError } from "../../../../../errors/ProteusError.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import { resolveColumnNameSafe } from "../resolve-column-name.js";
import type { AliasMap } from "./compile-select.js";
import { compilePredicate } from "./compile-where.js";
import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata.js";

const getJoinVersionCondition = (
  foreignMeta: EntityMetadata,
  targetAlias: string,
  versionTimestamp: Date | null,
  params: Array<unknown>,
): string | null => {
  const startField = foreignMeta.fields.find((f) => f.decorator === "VersionStartDate");
  const endField = foreignMeta.fields.find((f) => f.decorator === "VersionEndDate");
  if (!startField || !endField) return null;

  const alias = quoteIdentifier(targetAlias);
  const startCol = `${alias}.${quoteIdentifier(startField.name)}`;
  const endCol = `${alias}.${quoteIdentifier(endField.name)}`;

  if (versionTimestamp) {
    params.push(versionTimestamp, versionTimestamp);
    return `${startCol} <= ? AND (${endCol} IS NULL OR ${endCol} > ?)`;
  }

  return `${endCol} IS NULL`;
};

export const compileJoin = (
  includes: Array<IncludeSpec>,
  rootMetadata: EntityMetadata,
  aliasMap: Array<AliasMap>,
  params: Array<unknown>,
  versionTimestamp?: Date | null,
): string => {
  if (includes.length === 0) return "";

  const clauses: Array<string> = [];
  const rootAlias = aliasMap[0];
  const ts = versionTimestamp ?? null;

  for (const inc of includes) {
    const relation = findRelationByKey(rootMetadata, inc.relation);
    const foreignMeta = getRelationMetadata(relation);

    const joinType = inc.required ? "INNER JOIN" : "LEFT JOIN";

    if (relation.joinTable && typeof relation.joinTable === "string") {
      // ManyToMany: join through the join table
      clauses.push(
        ...compileManyToManyJoin(
          relation,
          rootMetadata,
          foreignMeta,
          aliasMap,
          rootAlias,
          joinType,
          inc,
          params,
          ts,
        ),
      );
    } else if (relation.joinKeys) {
      // Owning side (ManyToOne or owning OneToOne): this entity has the FK
      clauses.push(
        compileOwningJoin(
          relation,
          rootMetadata,
          foreignMeta,
          aliasMap,
          rootAlias,
          joinType,
          inc,
          params,
          ts,
        ),
      );
    } else if (relation.findKeys) {
      // Inverse side (OneToMany or inverse OneToOne): foreign entity has the FK
      clauses.push(
        compileInverseJoin(
          relation,
          rootMetadata,
          foreignMeta,
          aliasMap,
          rootAlias,
          joinType,
          inc,
          params,
          ts,
        ),
      );
    }
  }

  return clauses.join(" ");
};

const compileManyToManyJoin = (
  relation: MetaRelation,
  rootMetadata: EntityMetadata,
  foreignMeta: EntityMetadata,
  aliasMap: Array<AliasMap>,
  rootAlias: AliasMap,
  joinType: string,
  inc: IncludeSpec,
  params: Array<unknown>,
  versionTimestamp: Date | null,
): Array<string> => {
  const joinTableAlias = aliasMap.find((a) => a.relationKey === `${inc.relation}__join`);
  const targetAlias = aliasMap.find((a) => a.relationKey === inc.relation);

  if (!joinTableAlias || !targetAlias) {
    throw new ProteusError(
      `compileJoin: missing alias for ManyToMany relation "${inc.relation}" -- ensure compile-select registered aliases`,
    );
  }

  // MySQL uses namespace (database) as qualifier
  const joinTableQualified = joinTableAlias.schema
    ? quoteQualifiedName(joinTableAlias.schema, relation.joinTable as string)
    : quoteIdentifier(relation.joinTable as string);
  const targetTableQualified = targetAlias.schema
    ? quoteQualifiedName(targetAlias.schema, foreignMeta.entity.name)
    : quoteIdentifier(foreignMeta.entity.name);

  // Join keys map: { joinTableCol: rootPK }
  const joinKeys = relation.joinKeys ?? {};

  const inverseRelation = foreignMeta.relations.find(
    (r) =>
      r.type === "ManyToMany" &&
      r.foreignKey === relation.key &&
      r.key === relation.foreignKey,
  );
  const foreignJoinKeys = inverseRelation?.joinKeys ?? relation.findKeys ?? {};

  // Root -> join table: root.PK = joinTable.joinCol
  const rootToJoinConditions = Object.entries(joinKeys).map(
    ([joinTableCol, rootPkKey]) => {
      const rootPkCol = resolveColumnNameSafe(rootMetadata.fields, rootPkKey);
      return `${quoteIdentifier(rootAlias.tableAlias)}.${quoteIdentifier(rootPkCol)} = ${quoteIdentifier(joinTableAlias.tableAlias)}.${quoteIdentifier(joinTableCol)}`;
    },
  );

  // Join table -> target: joinTable.foreignJoinCol = target.PK
  const joinToTargetConditions = Object.entries(foreignJoinKeys).map(
    ([joinTableCol, foreignPkKey]) => {
      const foreignPkCol = resolveColumnNameSafe(foreignMeta.fields, foreignPkKey);
      return `${quoteIdentifier(joinTableAlias.tableAlias)}.${quoteIdentifier(joinTableCol)} = ${quoteIdentifier(targetAlias.tableAlias)}.${quoteIdentifier(foreignPkCol)}`;
    },
  );

  const versionCond = getJoinVersionCondition(
    foreignMeta,
    targetAlias.tableAlias,
    versionTimestamp,
    params,
  );
  if (versionCond) joinToTargetConditions.push(versionCond);

  if (inc.where) {
    const extra = compilePredicate(
      inc.where,
      foreignMeta,
      targetAlias.tableAlias,
      params,
    );
    if (extra) joinToTargetConditions.push(extra);
  }

  return [
    `${joinType} ${joinTableQualified} AS ${quoteIdentifier(joinTableAlias.tableAlias)} ON ${rootToJoinConditions.join(" AND ")}`,
    `${joinType} ${targetTableQualified} AS ${quoteIdentifier(targetAlias.tableAlias)} ON ${joinToTargetConditions.join(" AND ")}`,
  ];
};

const compileOwningJoin = (
  relation: MetaRelation,
  rootMetadata: EntityMetadata,
  foreignMeta: EntityMetadata,
  aliasMap: Array<AliasMap>,
  rootAlias: AliasMap,
  joinType: string,
  inc: IncludeSpec,
  params: Array<unknown>,
  versionTimestamp: Date | null,
): string => {
  const targetAlias = aliasMap.find((a) => a.relationKey === inc.relation);
  if (!targetAlias) {
    throw new ProteusError(
      `compileJoin: missing alias for owning relation "${inc.relation}" -- ensure compile-select registered aliases`,
    );
  }

  const targetTableQualified = targetAlias.schema
    ? quoteQualifiedName(targetAlias.schema, foreignMeta.entity.name)
    : quoteIdentifier(foreignMeta.entity.name);

  // joinKeys: { localFKField: foreignPKField }
  const conditions = Object.entries(relation.joinKeys!).map(([localKey, foreignKey]) => {
    const localCol = resolveColumnNameSafe(rootMetadata.fields, localKey);
    const foreignCol = resolveColumnNameSafe(foreignMeta.fields, foreignKey);
    return `${quoteIdentifier(rootAlias.tableAlias)}.${quoteIdentifier(localCol)} = ${quoteIdentifier(targetAlias.tableAlias)}.${quoteIdentifier(foreignCol)}`;
  });

  const versionCond = getJoinVersionCondition(
    foreignMeta,
    targetAlias.tableAlias,
    versionTimestamp,
    params,
  );
  if (versionCond) conditions.push(versionCond);

  if (inc.where) {
    const extra = compilePredicate(
      inc.where,
      foreignMeta,
      targetAlias.tableAlias,
      params,
    );
    if (extra) conditions.push(extra);
  }

  return `${joinType} ${targetTableQualified} AS ${quoteIdentifier(targetAlias.tableAlias)} ON ${conditions.join(" AND ")}`;
};

const compileInverseJoin = (
  relation: MetaRelation,
  rootMetadata: EntityMetadata,
  foreignMeta: EntityMetadata,
  aliasMap: Array<AliasMap>,
  rootAlias: AliasMap,
  joinType: string,
  inc: IncludeSpec,
  params: Array<unknown>,
  versionTimestamp: Date | null,
): string => {
  const targetAlias = aliasMap.find((a) => a.relationKey === inc.relation);
  if (!targetAlias) {
    throw new ProteusError(
      `compileJoin: missing alias for inverse relation "${inc.relation}" -- ensure compile-select registered aliases`,
    );
  }

  const targetTableQualified = targetAlias.schema
    ? quoteQualifiedName(targetAlias.schema, foreignMeta.entity.name)
    : quoteIdentifier(foreignMeta.entity.name);

  // findKeys on the relation: { foreignFKField: localPKField }
  const conditions = Object.entries(relation.findKeys!).map(([foreignKey, localKey]) => {
    const localCol = resolveColumnNameSafe(rootMetadata.fields, localKey);
    const foreignCol = resolveColumnNameSafe(foreignMeta.fields, foreignKey);
    return `${quoteIdentifier(rootAlias.tableAlias)}.${quoteIdentifier(localCol)} = ${quoteIdentifier(targetAlias.tableAlias)}.${quoteIdentifier(foreignCol)}`;
  });

  const versionCond = getJoinVersionCondition(
    foreignMeta,
    targetAlias.tableAlias,
    versionTimestamp,
    params,
  );
  if (versionCond) conditions.push(versionCond);

  if (inc.where) {
    const extra = compilePredicate(
      inc.where,
      foreignMeta,
      targetAlias.tableAlias,
      params,
    );
    if (extra) conditions.push(extra);
  }

  return `${joinType} ${targetTableQualified} AS ${quoteIdentifier(targetAlias.tableAlias)} ON ${conditions.join(" AND ")}`;
};
