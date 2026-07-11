import { isString } from "@lindorm/is";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { NamespaceOptions, ScopedName } from "../../types/types.js";
import type {
  DesiredColumnModel,
  DesiredForeignKeyModel,
  DesiredIndexModel,
  DesiredTableModel,
} from "./desired-schema-model.js";
import type { SyncDialect } from "./sync-dialect.js";
import { getEntityName } from "../../entity/utils/get-entity-name.js";
import { getJoinName } from "../../entity/utils/get-join-name.js";
import { getForeignMetadata } from "../../entity/metadata/foreign-metadata.js";
import { buildForeignKeyName, buildIndexName } from "../sql/constraint-names.js";
import { hasProjectedTable } from "./has-projected-table.js";
import { resolveColumnNameSafe } from "../sql/resolve-column-name.js";

export type ProjectJoinTablesOptions = {
  metadata: EntityMetadata;
  entityName: ScopedName;
  tables: Array<DesiredTableModel>;
  namespaceSet: Set<string>;
  dialect: SyncDialect;
  namespaceOptions: NamespaceOptions;
};

const fkColumn = (name: string, columnType: string): DesiredColumnModel => ({
  name,
  columnType,
  nullable: false,
  defaultExpr: null,
  identity: null,
  generatedExpr: null,
  collation: null,
  enumValues: null,
  checkExpr: null,
  origin: "fk",
});

/**
 * Projects ManyToMany join tables for an entity's owning-side M2M relations:
 * owner + foreign FK columns (composite PK), FK constraints to both sides with
 * ON DELETE CASCADE, and a reverse-side lookup index. Both M2M sides project
 * the same join table — the first one wins (dedupe via `hasProjectedTable`).
 */
export const projectJoinTables = (options: ProjectJoinTablesOptions): void => {
  const { metadata, entityName, tables, namespaceSet, dialect, namespaceOptions } =
    options;
  const { namespace } = entityName;

  for (const relation of metadata.relations) {
    if (relation.type !== "ManyToMany") continue;
    if (!isString(relation.joinTable)) continue;
    if (!relation.joinKeys) continue;

    const joinScopedName = getJoinName(relation.joinTable, namespaceOptions);
    const joinTableName = joinScopedName.name;
    const joinNamespace = joinScopedName.namespace;

    if (dialect.supportsNamespaces && joinNamespace) namespaceSet.add(joinNamespace);

    // Check if we already added this join table (both sides of M2M add it)
    if (hasProjectedTable(tables, joinTableName, joinNamespace, dialect)) {
      continue;
    }

    const foreignMeta = getForeignMetadata(relation, relation.foreignConstructor());
    const foreignName = getEntityName(foreignMeta, namespaceOptions);
    const inverseRelation = foreignMeta.relations.find(
      (r) =>
        r.foreignKey === relation.key &&
        r.key === relation.foreignKey &&
        r.type === "ManyToMany",
    );

    const joinColumns: Array<DesiredColumnModel> = [];
    const joinPkCols: Array<string> = [];
    const foreignKeys: Array<DesiredForeignKeyModel> = [];
    const joinIndexes: Array<DesiredIndexModel> = [];
    const foreignSideCols: Array<string> = [];

    // Owner-side columns
    for (const [joinCol, ownerPk] of Object.entries(relation.joinKeys)) {
      joinColumns.push(
        fkColumn(
          joinCol,
          dialect.resolveFkColumnType(metadata, ownerPk, namespaceOptions),
        ),
      );
      joinPkCols.push(joinCol);
    }

    // Foreign-side columns
    if (inverseRelation?.joinKeys) {
      for (const [joinCol, foreignPk] of Object.entries(inverseRelation.joinKeys)) {
        joinColumns.push(
          fkColumn(
            joinCol,
            dialect.resolveFkColumnType(foreignMeta, foreignPk, namespaceOptions),
          ),
        );
        joinPkCols.push(joinCol);
        foreignSideCols.push(joinCol);
      }
    }

    // FK constraints for join table
    for (const [joinCol, ownerPk] of Object.entries(relation.joinKeys)) {
      foreignKeys.push({
        kind: "join_table",
        name: dialect.namedForeignKeys
          ? buildForeignKeyName(joinTableName, joinCol)
          : null,
        columns: [joinCol],
        foreignNamespace: namespace,
        foreignTable: entityName.name,
        foreignColumns: [resolveColumnNameSafe(metadata.fields, ownerPk)],
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
        deferrable: false,
        initiallyDeferred: false,
      });
    }

    if (inverseRelation?.joinKeys) {
      for (const [joinCol, foreignPk] of Object.entries(inverseRelation.joinKeys)) {
        foreignKeys.push({
          kind: "join_table",
          name: dialect.namedForeignKeys
            ? buildForeignKeyName(joinTableName, joinCol)
            : null,
          columns: [joinCol],
          foreignNamespace: foreignName.namespace,
          foreignTable: foreignName.name,
          foreignColumns: [resolveColumnNameSafe(foreignMeta.fields, foreignPk)],
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
          deferrable: false,
          initiallyDeferred: false,
        });
      }
    }

    // Reverse-side index
    if (foreignSideCols.length > 0) {
      joinIndexes.push({
        name: buildIndexName(joinTableName, foreignSideCols),
        unique: false,
        columns: foreignSideCols.map((c) => ({
          name: c,
          direction: "asc" as const,
          opclass: null,
          prefixLength: null,
        })),
        method: "btree",
        where: null,
        include: null,
        concurrent: false,
        origin: "auto",
      });
    }

    tables.push({
      namespace: joinNamespace,
      name: joinTableName,
      columns: joinColumns,
      primaryKey: { columns: joinPkCols },
      foreignKeys,
      uniques: [],
      checks: [],
      indexes: joinIndexes,
      comment: null,
      columnComments: {},
      triggers: [],
    });
  }
};
