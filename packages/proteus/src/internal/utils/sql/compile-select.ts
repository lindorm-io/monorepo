import { isNumber } from "@lindorm/is";
import { ProteusError } from "../../../errors";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "../../entity/types/metadata";
import type { IncludeSpec, RawSelectEntry, WindowSpec } from "../../types/query";
import { resolveColumnName } from "./resolve-column-name";
import type { SqlDialect } from "./sql-dialect";
import type { AliasMap, BuiltAliasResult, InheritanceAliasMap } from "./types";

export type CompileSelectDeps = {
  buildInheritanceAliases: (
    metadata: EntityMetadata,
    namespace: string | null,
    startCounter: number,
  ) => { aliases: Array<InheritanceAliasMap>; nextCounter: number };
  resolveTableName: (
    metadata: EntityMetadata,
    namespace?: string | null,
  ) => { schema: string | null; name: string };
  findRelationByKey: (
    metadata: EntityMetadata,
    relationKey: string,
  ) => import("../../entity/types/metadata").MetaRelation;
  getRelationMetadata: (
    relation: import("../../entity/types/metadata").MetaRelation,
  ) => EntityMetadata;
};

export const buildAliasMap = (
  rootMetadata: EntityMetadata,
  includes: Array<IncludeSpec>,
  dialect: SqlDialect,
  deps: CompileSelectDeps,
  defaultNamespace?: string | null,
): BuiltAliasResult => {
  const resolved = deps.resolveTableName(rootMetadata, defaultNamespace);
  const aliases: Array<AliasMap> = [
    {
      tableAlias: "t0",
      schema: resolved.schema,
      tableName: resolved.name,
      relationKey: null,
      metadata: rootMetadata,
    },
  ];

  // Build inheritance aliases (for joined strategy)
  const { aliases: inheritanceAliases, nextCounter } = deps.buildInheritanceAliases(
    rootMetadata,
    defaultNamespace ?? null,
    1,
  );

  for (const inhAlias of inheritanceAliases) {
    aliases.push(inhAlias);
  }

  let counter = nextCounter;

  const resolveRelationSchema = (meta: EntityMetadata): string | null =>
    dialect.supportsNamespace
      ? (meta.entity.namespace ?? defaultNamespace ?? null)
      : null;

  for (const inc of includes) {
    const relation = deps.findRelationByKey(rootMetadata, inc.relation);
    const foreignMeta = deps.getRelationMetadata(relation);

    // For M2M, the join table gets an alias too
    if (relation.joinTable && typeof relation.joinTable === "string") {
      aliases.push({
        tableAlias: `t${counter}`,
        schema: resolveRelationSchema(rootMetadata),
        tableName: relation.joinTable,
        relationKey: `${inc.relation}__join`,
        metadata: rootMetadata, // join table doesn't have its own metadata
      });
      counter++;
    }

    aliases.push({
      tableAlias: `t${counter}`,
      schema: resolveRelationSchema(foreignMeta),
      tableName: foreignMeta.entity.name,
      relationKey: inc.relation,
      metadata: foreignMeta,
    });
    counter++;
  }

  return { aliasMap: aliases, inheritanceAliases };
};

export const compileSelect = <E extends IEntity>(
  rootMetadata: EntityMetadata,
  aliasMap: Array<AliasMap>,
  selections: Array<keyof E> | null,
  includes: Array<IncludeSpec>,
  distinct: boolean,
  dialect: SqlDialect,
  deps: Pick<CompileSelectDeps, "findRelationByKey" | "getRelationMetadata">,
  rawSelections?: Array<RawSelectEntry>,
  windows?: Array<WindowSpec<E>>,
  params?: Array<unknown>,
  inheritanceAliases?: Array<InheritanceAliasMap>,
): string => {
  const columns: Array<string> = [];
  const rootAlias = aliasMap[0];

  // For joined inheritance, determine which fields belong to the root table
  const hasInheritanceAliases = inheritanceAliases && inheritanceAliases.length > 0;
  const childFieldKeys = new Set<string>();
  if (hasInheritanceAliases) {
    for (const inhAlias of inheritanceAliases) {
      for (const f of inhAlias.childFields) {
        childFieldKeys.add(f.key);
      }
    }
  }

  // Root entity columns — for joined inheritance, only emit fields that are on the root table
  const rootFields = selections
    ? rootMetadata.fields.filter(
        (f) =>
          (selections as Array<string>).includes(f.key) && !childFieldKeys.has(f.key),
      )
    : rootMetadata.fields.filter((f) => !childFieldKeys.has(f.key));

  for (const field of rootFields) {
    const col = dialect.quoteIdentifier(field.name);
    const alias = `t0_${field.key}`;
    columns.push(
      `${dialect.quoteIdentifier(rootAlias.tableAlias)}.${col} AS ${dialect.quoteIdentifier(alias)}`,
    );
  }

  // Child-only columns from joined inheritance aliases
  if (hasInheritanceAliases) {
    for (const inhAlias of inheritanceAliases) {
      const childFields = selections
        ? inhAlias.childFields.filter((f) =>
            (selections as Array<string>).includes(f.key),
          )
        : inhAlias.childFields;

      for (const field of childFields) {
        const col = dialect.quoteIdentifier(field.name);
        const alias = `t0_${field.key}`;
        columns.push(
          `${dialect.quoteIdentifier(inhAlias.tableAlias)}.${col} AS ${dialect.quoteIdentifier(alias)}`,
        );
      }
    }
  }

  // FK columns from owning-side relations (non-ManyToMany)
  const handledKeys = new Set(rootFields.map((f) => f.key));
  for (const f of childFieldKeys) handledKeys.add(f);
  for (const relation of rootMetadata.relations) {
    if (!relation.joinKeys || relation.type === "ManyToMany") continue;

    for (const [localKey] of Object.entries(relation.joinKeys)) {
      if (handledKeys.has(localKey)) continue;
      handledKeys.add(localKey);

      const col = dialect.quoteIdentifier(localKey);
      const alias = `t0_${localKey}`;
      columns.push(
        `${dialect.quoteIdentifier(rootAlias.tableAlias)}.${col} AS ${dialect.quoteIdentifier(alias)}`,
      );
    }
  }

  // Included relation columns
  for (const inc of includes) {
    const relation = deps.findRelationByKey(rootMetadata, inc.relation);
    const foreignMeta = deps.getRelationMetadata(relation);

    const targetAlias = aliasMap.find((a) => a.relationKey === inc.relation);
    if (!targetAlias) continue;

    const relFields = inc.select
      ? foreignMeta.fields.filter((f) => inc.select!.includes(f.key))
      : foreignMeta.fields;

    for (const field of relFields) {
      const col = dialect.quoteIdentifier(field.name);
      const alias = `${targetAlias.tableAlias}_${field.key}`;
      columns.push(
        `${dialect.quoteIdentifier(targetAlias.tableAlias)}.${col} AS ${dialect.quoteIdentifier(alias)}`,
      );
    }
  }

  // Raw selections — PG uses reindexRawParams for $N renumbering; MySQL/SQLite push directly
  if (rawSelections && rawSelections.length > 0) {
    if (!params) {
      throw new ProteusError("params array required when rawSelections are provided");
    }
    for (const raw of rawSelections) {
      if (dialect.reindexRawParams) {
        const reindexed = dialect.reindexRawParams(raw.expression, raw.params, params);
        columns.push(`${reindexed} AS ${dialect.quoteIdentifier(raw.alias)}`);
      } else {
        params.push(...raw.params);
        columns.push(`${raw.expression} AS ${dialect.quoteIdentifier(raw.alias)}`);
      }
    }
  }

  // Window function selections
  if (windows && windows.length > 0) {
    for (const spec of windows) {
      columns.push(
        compileWindowSelection(spec, rootMetadata, rootAlias.tableAlias, dialect),
      );
    }
  }

  const distinctClause = distinct ? "DISTINCT " : "";
  return `SELECT ${distinctClause}${columns.join(", ")}`;
};

const compileWindowSelection = <E extends IEntity>(
  spec: WindowSpec<E>,
  metadata: EntityMetadata,
  tableAlias: string,
  dialect: SqlDialect,
): string => {
  const fnArgs = spec.args
    ? spec.args
        .map((arg) => {
          if (isNumber(arg)) return String(arg);
          const colName = resolveColumnName(
            metadata.fields,
            arg as string,
            metadata.relations,
          );
          return `${dialect.quoteIdentifier(tableAlias)}.${dialect.quoteIdentifier(colName)}`;
        })
        .join(", ")
    : "";

  const overParts: Array<string> = [];

  if (spec.partitionBy && spec.partitionBy.length > 0) {
    const cols = spec.partitionBy.map((key) => {
      const colName = resolveColumnName(
        metadata.fields,
        key as string,
        metadata.relations,
      );
      return `${dialect.quoteIdentifier(tableAlias)}.${dialect.quoteIdentifier(colName)}`;
    });
    overParts.push(`PARTITION BY ${cols.join(", ")}`);
  }

  if (spec.orderBy) {
    const entries = Object.entries(spec.orderBy) as Array<[string, "ASC" | "DESC"]>;
    if (entries.length > 0) {
      const cols = entries.map(([key, dir]) => {
        const colName = resolveColumnName(metadata.fields, key, metadata.relations);
        return `${dialect.quoteIdentifier(tableAlias)}.${dialect.quoteIdentifier(colName)} ${dir}`;
      });
      overParts.push(`ORDER BY ${cols.join(", ")}`);
    }
  }

  return `${spec.fn}(${fnArgs}) OVER (${overParts.join(" ")}) AS ${dialect.quoteIdentifier(spec.alias)}`;
};

export const compileFrom = (
  aliasMap: Array<AliasMap>,
  dialect: SqlDialect,
  cteFrom?: string | null,
): string => {
  const root = aliasMap[0];

  if (cteFrom) {
    return `FROM ${dialect.quoteIdentifier(cteFrom)} AS ${dialect.quoteIdentifier(root.tableAlias)}`;
  }

  const qualifiedName = dialect.quoteQualifiedName(root.schema, root.tableName);
  return `FROM ${qualifiedName} AS ${dialect.quoteIdentifier(root.tableAlias)}`;
};
