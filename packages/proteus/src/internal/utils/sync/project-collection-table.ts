import type { EntityMetadata } from "../../entity/types/metadata.js";
import type {
  DesiredColumnModel,
  DesiredEnumModel,
  DesiredForeignKeyModel,
  DesiredIndexModel,
  DesiredTableModel,
} from "./desired-schema-model.js";
import type { SyncDialect } from "./sync-dialect.js";
import { addNamedEnum } from "./add-named-enum.js";
import { buildForeignKeyName, buildIndexName } from "../sql/constraint-names.js";
import { buildPrimitiveElementField } from "./primitive-element-field.js";
import { hasProjectedTable } from "./has-projected-table.js";
import { resolveColumnNameSafe } from "../sql/resolve-column-name.js";

export type ProjectCollectionTablesOptions = {
  metadata: EntityMetadata;
  tableName: string;
  namespace: string | null;
  tables: Array<DesiredTableModel>;
  enums: Array<DesiredEnumModel>;
  enumSet: Set<string>;
  namespaceSet: Set<string>;
  dialect: SyncDialect;
};

/**
 * Projects EmbeddedList collection tables: a parent-FK column + `__ordinal`
 * ordering column, then either one column per embeddable element field (named
 * enum types collected for pg) or a single "value" column for primitive
 * elements. The parent FK cascades on delete/update and gets a lookup index.
 * Drift (kept): pg collection tables carry no primary key; mysql/sqlite use
 * (parentFk, __ordinal).
 */
export const projectCollectionTables = (
  options: ProjectCollectionTablesOptions,
): void => {
  const {
    metadata,
    tableName,
    namespace,
    tables,
    enums,
    enumSet,
    namespaceSet,
    dialect,
  } = options;

  for (const embeddedList of metadata.embeddedLists ?? []) {
    const collTableName = embeddedList.tableName;
    const collNamespace = namespace;

    if (dialect.supportsNamespaces && collNamespace) namespaceSet.add(collNamespace);

    // Check if already added (shouldn't happen, but be safe)
    if (hasProjectedTable(tables, collTableName, collNamespace, dialect)) {
      continue;
    }

    const collColumns: Array<DesiredColumnModel> = [];
    const foreignKeys: Array<DesiredForeignKeyModel> = [];
    const collIndexes: Array<DesiredIndexModel> = [];

    // FK column pointing to parent entity PK
    const pkField = metadata.fields.find((f) => f.key === embeddedList.parentPkColumn);

    collColumns.push({
      name: embeddedList.parentFkColumn,
      columnType: dialect.collectionParentFkColumnType(
        pkField,
        collTableName,
        collNamespace,
      ),
      nullable: false,
      defaultExpr: null,
      identity: null,
      generatedExpr: null,
      collation: null,
      enumValues: null,
      checkExpr: null,
      origin: "fk",
    });

    // Ordinal column — preserves array element ordering across delete+insert cycles
    collColumns.push({
      name: "__ordinal",
      columnType: dialect.ordinalColumnType,
      nullable: false,
      defaultExpr: null,
      identity: null,
      generatedExpr: null,
      collation: null,
      enumValues: null,
      checkExpr: null,
      origin: "ordinal",
    });

    if (embeddedList.elementFields) {
      // Embeddable element: one column per field
      for (const field of embeddedList.elementFields) {
        const projected = dialect.projectColumnType(field, collTableName, collNamespace);
        collColumns.push({
          name: field.name,
          columnType: projected.type,
          nullable: field.nullable,
          defaultExpr: null,
          identity: null,
          generatedExpr: null,
          collation: field.collation,
          enumValues: projected.enumValues,
          checkExpr: projected.checkExpr,
          origin: "element",
        });

        // Enums within embeddable fields (deduplicated)
        addNamedEnum(
          dialect.namedEnumType(field, collTableName, collNamespace),
          enums,
          enumSet,
        );
      }
    } else if (embeddedList.elementType) {
      // Primitive element: single "value" column
      const primitiveField = buildPrimitiveElementField(embeddedList.elementType);
      const projected = dialect.projectColumnType(
        primitiveField,
        collTableName,
        collNamespace,
      );
      collColumns.push({
        name: "value",
        columnType: projected.type,
        nullable: false,
        defaultExpr: null,
        identity: null,
        generatedExpr: null,
        collation: null,
        enumValues: null,
        checkExpr: null,
        origin: "value",
      });
    }

    // FK constraint with ON DELETE CASCADE
    const parentPkColumnName = resolveColumnNameSafe(
      metadata.fields,
      embeddedList.parentPkColumn,
    );

    foreignKeys.push({
      kind: "collection",
      name: dialect.namedForeignKeys
        ? buildForeignKeyName(collTableName, embeddedList.parentFkColumn)
        : null,
      columns: [embeddedList.parentFkColumn],
      foreignNamespace: namespace,
      foreignTable: tableName,
      foreignColumns: [parentPkColumnName],
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      deferrable: false,
      initiallyDeferred: false,
    });

    // Index on FK column for efficient lookups
    collIndexes.push({
      name: buildIndexName(collTableName, [embeddedList.parentFkColumn]),
      unique: false,
      columns: [
        {
          name: embeddedList.parentFkColumn,
          direction: "asc",
          opclass: null,
          prefixLength: null,
        },
      ],
      method: "btree",
      where: null,
      include: null,
      concurrent: false,
      origin: "auto",
    });

    tables.push({
      namespace: collNamespace,
      name: collTableName,
      columns: collColumns,
      primaryKey: { columns: [embeddedList.parentFkColumn, "__ordinal"] },
      foreignKeys,
      uniques: [],
      checks: [],
      indexes: collIndexes,
      comment: null,
      columnComments: {},
      triggers: [],
    });
  }
};
