import type { EntityMetadata } from "#internal/entity/types/metadata";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import type { SqlDialect } from "./sql-dialect";
import type { InheritanceAliasMap } from "./types";

export type { InheritanceAliasMap };

export const buildInheritanceAliases = (
  metadata: EntityMetadata,
  namespace: string | null,
  startCounter: number,
  dialect: SqlDialect,
): { aliases: Array<InheritanceAliasMap>; nextCounter: number } => {
  const inh = metadata.inheritance;
  if (!inh || inh.strategy !== "joined") {
    return { aliases: [], nextCounter: startCounter };
  }

  const aliases: Array<InheritanceAliasMap> = [];
  let counter = startCounter;

  const resolveSchema = (meta: EntityMetadata): string | null =>
    dialect.supportsNamespace ? (meta.entity.namespace ?? namespace ?? null) : null;

  if (inh.discriminatorValue != null) {
    const childFields = getChildOnlyFields(metadata);
    aliases.push({
      tableAlias: `t${counter}`,
      schema: resolveSchema(metadata),
      tableName: metadata.entity.name,
      relationKey: null,
      metadata,
      childFields,
    });
    counter++;
  } else if (inh.children.size > 0) {
    for (const [, childConstructor] of inh.children) {
      const childMeta = getEntityMetadata(childConstructor);
      const childFields = getChildOnlyFields(childMeta);

      aliases.push({
        tableAlias: `t${counter}`,
        schema: resolveSchema(childMeta),
        tableName: childMeta.entity.name,
        relationKey: null,
        metadata: childMeta,
        childFields,
      });
      counter++;
    }
  }

  return { aliases, nextCounter: counter };
};

export const compileInheritanceJoin = (
  metadata: EntityMetadata,
  inheritanceAliases: Array<InheritanceAliasMap>,
  rootAlias: string,
  dialect: SqlDialect,
): string => {
  if (inheritanceAliases.length === 0) return "";

  const inh = metadata.inheritance!;
  const rootMeta = getEntityMetadata(inh.root);
  const isChild = inh.discriminatorValue != null;
  const joinType = isChild ? "INNER JOIN" : "LEFT JOIN";

  const clauses: Array<string> = [];

  for (const alias of inheritanceAliases) {
    const qualifiedName = alias.schema
      ? dialect.quoteQualifiedName(alias.schema, alias.tableName)
      : dialect.quoteIdentifier(alias.tableName);

    const conditions = rootMeta.primaryKeys.map((pk) => {
      const rootCol = rootMeta.fields.find((f) => f.key === pk)?.name ?? pk;
      const childCol = alias.metadata.fields.find((f) => f.key === pk)?.name ?? pk;
      return `${dialect.quoteIdentifier(alias.tableAlias)}.${dialect.quoteIdentifier(childCol)} = ${dialect.quoteIdentifier(rootAlias)}.${dialect.quoteIdentifier(rootCol)}`;
    });

    clauses.push(
      `${joinType} ${qualifiedName} AS ${dialect.quoteIdentifier(alias.tableAlias)} ON ${conditions.join(" AND ")}`,
    );
  }

  return clauses.join(" ");
};

export const compileInheritanceFrom = (
  metadata: EntityMetadata,
  inheritanceAliases: Array<InheritanceAliasMap>,
  rootAlias: string,
  dialect: SqlDialect,
): { fromClause: string; joinConditions: Array<string> } => {
  if (inheritanceAliases.length === 0) return { fromClause: "", joinConditions: [] };

  const inh = metadata.inheritance!;
  const rootMeta = getEntityMetadata(inh.root);

  const tables: Array<string> = [];
  const conditions: Array<string> = [];

  for (const alias of inheritanceAliases) {
    const qualifiedName = alias.schema
      ? dialect.quoteQualifiedName(alias.schema, alias.tableName)
      : dialect.quoteIdentifier(alias.tableName);

    tables.push(`${qualifiedName} AS ${dialect.quoteIdentifier(alias.tableAlias)}`);

    const pkConditions = rootMeta.primaryKeys.map((pk) => {
      const rootCol = rootMeta.fields.find((f) => f.key === pk)?.name ?? pk;
      const childCol = alias.metadata.fields.find((f) => f.key === pk)?.name ?? pk;
      return `${dialect.quoteIdentifier(alias.tableAlias)}.${dialect.quoteIdentifier(childCol)} = ${dialect.quoteIdentifier(rootAlias)}.${dialect.quoteIdentifier(rootCol)}`;
    });

    conditions.push(...pkConditions);
  }

  return {
    fromClause: tables.length > 0 ? `FROM ${tables.join(", ")}` : "",
    joinConditions: conditions,
  };
};

const getChildOnlyFields = (childMeta: EntityMetadata): EntityMetadata["fields"] => {
  const inh = childMeta.inheritance;
  if (!inh) return [];

  const rootMeta = getEntityMetadata(inh.root);
  const rootFieldKeys = new Set(rootMeta.fields.map((f) => f.key));

  return childMeta.fields.filter(
    (f) => !rootFieldKeys.has(f.key) && !childMeta.primaryKeys.includes(f.key),
  );
};
