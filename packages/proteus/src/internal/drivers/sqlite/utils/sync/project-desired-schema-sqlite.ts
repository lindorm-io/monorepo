import { isBoolean, isNumber, isString } from "@lindorm/is";
import type {
  SqliteDesiredColumn,
  SqliteDesiredForeignKey,
  SqliteDesiredIndex,
  SqliteDesiredSchema,
  SqliteDesiredTable,
  SqliteDesiredTrigger,
  SqliteDesiredUnique,
} from "../../types/desired-schema.js";
import type {
  RelationChange,
  RelationDestroy,
} from "../../../../entity/types/metadata.js";
import type {
  EntityMetadata,
  MetaField,
  MetaGenerated,
} from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { getJoinName } from "../../../../entity/utils/get-join-name.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { extractEnumValues } from "../../../../utils/extract-enum-values.js";
import { generateAppendOnlyDDL } from "../ddl/generate-append-only-ddl.js";
import { hashIdentifier } from "../hash-identifier.js";
import { mapFieldTypeSqlite } from "../map-field-type-sqlite.js";
import { SQLITE_IDENTIFIER_LIMIT } from "../../constants/sqlite-constants.js";
import { SqliteSyncError } from "../../errors/SqliteSyncError.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveColumnNameSafe } from "../resolve-column-name.js";
import { resolveFkColumnType } from "../resolve-fk-column-type.js";

const mapOnDeleteAction = (onDestroy: RelationDestroy): string => {
  switch (onDestroy) {
    case "cascade":
      return "CASCADE";
    case "restrict":
      return "RESTRICT";
    case "set_null":
      return "SET NULL";
    case "set_default":
      return "SET DEFAULT";
    case "ignore":
      return "NO ACTION";
    default:
      throw new SqliteSyncError(`Unsupported onDestroy value: "${onDestroy as string}"`);
  }
};

const mapOnUpdateAction = (onUpdate: RelationChange): string => {
  switch (onUpdate) {
    case "cascade":
      return "CASCADE";
    case "restrict":
      return "RESTRICT";
    case "set_null":
      return "SET NULL";
    case "set_default":
      return "SET DEFAULT";
    case "ignore":
      return "NO ACTION";
    default:
      throw new SqliteSyncError(`Unsupported onUpdate value: "${onUpdate as string}"`);
  }
};

const buildEnumCheckExpr = (field: MetaField, colName: string): string | null => {
  if (field.type !== "enum" || !field.enum) return null;
  const values = extractEnumValues(field.enum);
  if (values.length === 0) return null;
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return `CHECK(${quoteIdentifier(colName)} IN (${escaped}))`;
};

const projectFieldColumn = (
  field: MetaField,
  generated: Array<MetaGenerated>,
): SqliteDesiredColumn => {
  const sqliteType = field.encrypted ? "TEXT" : mapFieldTypeSqlite(field);
  const gen = generated.find((g) => g.key === field.key);

  let defaultExpr: string | null = null;
  let isAutoincrement = false;

  if (field.computed) {
    // Computed columns are stored as GENERATED ALWAYS AS ... STORED
    // No default, no autoincrement, no check needed
  } else if (gen?.strategy === "increment") {
    isAutoincrement = true;
  } else if (gen?.strategy === "uuid") {
    // UUID generated app-side; no default in SQLite
  } else if (field.default !== null && typeof field.default !== "function") {
    const d = field.default;
    if (isString(d)) {
      defaultExpr = `'${d.replace(/'/g, "''")}'`;
    } else if (isNumber(d) || typeof d === "bigint") {
      defaultExpr = `${d}`;
    } else if (isBoolean(d)) {
      defaultExpr = `${d ? 1 : 0}`;
    }
  }

  // Inline CHECK for enum fields
  const checkExpr = buildEnumCheckExpr(field, field.name);

  return {
    name: field.name,
    sqliteType,
    nullable: field.embedded ? true : field.nullable,
    defaultExpr,
    isAutoincrement,
    checkExpr,
  };
};

const projectFkColumn = (
  joinCol: string,
  foreignPkKey: string,
  foreignConstructor: () => any,
): SqliteDesiredColumn => {
  const sqliteType = resolveFkColumnType(foreignConstructor, foreignPkKey);

  return {
    name: joinCol,
    sqliteType,
    nullable: false,
    defaultExpr: null,
    isAutoincrement: false,
    checkExpr: null,
  };
};

/**
 * Projects entity metadata into a `SqliteDesiredSchema` structure for comparison with
 * the DB snapshot. Handles tables, columns (including FK and embedded), constraints
 * (PK, UNIQUE, CHECK, FK), indexes, and ManyToMany join tables.
 *
 * SQLite differences from PG:
 * - No enum types (inline CHECK constraints instead)
 * - No schema tracking
 * - No extensions
 * - No comments
 * - FKs are inline in CREATE TABLE
 */
export const projectDesiredSchemaSqlite = (
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
): SqliteDesiredSchema => {
  const tables: Array<SqliteDesiredTable> = [];

  for (const metadata of metadataList) {
    // Skip child entities in single-table inheritance — the root entity's projection
    // already includes all subtype fields (merged by mergeSingleTableSubtypeFields).
    if (
      metadata.inheritance?.strategy === "single-table" &&
      metadata.inheritance.discriminatorValue != null
    ) {
      continue;
    }

    // Determine if this is a joined child entity.
    const isJoinedChild =
      metadata.inheritance?.strategy === "joined" &&
      metadata.inheritance.discriminatorValue != null;

    // For joined children, compute the set of root field keys.
    let rootFieldKeys: Set<string> | null = null;
    let rootEntityName: ReturnType<typeof getEntityName> | null = null;
    if (isJoinedChild) {
      const rootMeta = getEntityMetadata(metadata.inheritance!.root);
      rootFieldKeys = new Set(rootMeta.fields.map((f) => f.key));
      rootEntityName = getEntityName(metadata.inheritance!.root, namespaceOptions);
    }

    const entityName = getEntityName(metadata.target, namespaceOptions);
    const tableName = entityName.name;

    // For joined children, only process child-specific fields + PK fields.
    const effectiveFields = isJoinedChild
      ? metadata.fields.filter(
          (f) => metadata.primaryKeys.includes(f.key) || !rootFieldKeys!.has(f.key),
        )
      : metadata.fields;

    // Validate column names
    for (const field of effectiveFields) {
      if (field.name.length > SQLITE_IDENTIFIER_LIMIT) {
        throw new SqliteSyncError(
          `Column name "${field.name}" on "${metadata.target.name}" exceeds ${SQLITE_IDENTIFIER_LIMIT} characters`,
        );
      }
    }

    // Columns
    const columns: Array<SqliteDesiredColumn> = [];
    for (const field of effectiveFields) {
      columns.push(projectFieldColumn(field, metadata.generated));
    }

    // FK columns from owning-side relations
    const fkColumnNames: Array<string> = [];
    for (const relation of metadata.relations) {
      if (!relation.joinKeys) continue;
      if (relation.type === "ManyToMany") continue;
      for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
        if (isJoinedChild && rootFieldKeys!.has(joinCol)) continue;
        if (effectiveFields.some((f) => !f.embedded && f.name === joinCol)) continue;
        columns.push(projectFkColumn(joinCol, foreignPk, relation.foreignConstructor));
        fkColumnNames.push(joinCol);
      }
    }

    // Validate embedded/FK column name collisions
    for (const fkCol of fkColumnNames) {
      const colliding = effectiveFields.find((f) => f.embedded && f.name === fkCol);
      if (colliding) {
        throw new SqliteSyncError(
          `Column name "${fkCol}" on "${metadata.target.name}" collides — embedded field "${colliding.key}" produces column "${colliding.name}" which conflicts with a relation FK column of the same name`,
        );
      }
    }

    // Primary keys
    const primaryKeys = metadata.primaryKeys.map((k) =>
      resolveColumnNameSafe(metadata.fields, k),
    );

    // Foreign keys
    const foreignKeys: Array<SqliteDesiredForeignKey> = [];

    // For joined children, add FK: child PK → root PK
    if (isJoinedChild && rootEntityName) {
      const rootMeta = getEntityMetadata(metadata.inheritance!.root);
      const pkColumns = metadata.primaryKeys.map((k) =>
        resolveColumnNameSafe(metadata.fields, k),
      );
      const rootPkColumns = rootMeta.primaryKeys.map((k) =>
        resolveColumnNameSafe(rootMeta.fields, k),
      );

      foreignKeys.push({
        columns: pkColumns,
        foreignTable: rootEntityName.name,
        foreignColumns: rootPkColumns,
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }

    // FK constraints from relations
    for (const relation of metadata.relations) {
      if (!relation.joinKeys) continue;
      if (relation.type === "ManyToMany") continue;

      const foreignName = getEntityName(relation.foreignConstructor(), namespaceOptions);
      const foreignMeta = getEntityMetadata(relation.foreignConstructor());

      for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
        if (isJoinedChild && rootFieldKeys!.has(joinCol)) continue;

        const resolvedJoinCol = resolveColumnNameSafe(metadata.fields, joinCol);
        const resolvedForeignPk = resolveColumnNameSafe(foreignMeta.fields, foreignPk);
        const onDelete = mapOnDeleteAction(relation.options.onDestroy);
        const onUpdate = mapOnUpdateAction(relation.options.onUpdate);

        foreignKeys.push({
          columns: [resolvedJoinCol],
          foreignTable: foreignName.name,
          foreignColumns: [resolvedForeignPk],
          onDelete,
          onUpdate,
        });
      }
    }

    // Unique constraints — for joined children, only project those whose keys are all child-specific
    const uniqueConstraints: Array<SqliteDesiredUnique> = [];
    for (const unique of metadata.uniques) {
      if (isJoinedChild) {
        const allChildKeys = unique.keys.every(
          (k) => metadata.primaryKeys.includes(k) || !rootFieldKeys!.has(k),
        );
        if (!allChildKeys) continue;
      }

      const resolvedUniqueKeys = unique.keys.map((k) =>
        resolveColumnNameSafe(metadata.fields, k),
      );
      const name =
        unique.name ??
        `uq_${hashIdentifier(`${tableName}_${resolvedUniqueKeys.join("_")}`)}`;
      uniqueConstraints.push({ name, columns: resolvedUniqueKeys });
    }

    // Check constraints
    const checkConstraints: Array<string> = [];
    for (const check of metadata.checks) {
      const name =
        check.name ?? `chk_${hashIdentifier(`${tableName}_${check.expression}`)}`;
      checkConstraints.push(
        `CONSTRAINT ${quoteIdentifier(name)} CHECK (${check.expression})`,
      );
    }

    // Indexes
    const indexes: Array<SqliteDesiredIndex> = [];
    for (const index of metadata.indexes) {
      const validKeys = index.keys.filter(
        (k) => k.direction === "asc" || k.direction === "desc",
      );
      if (validKeys.length === 0) continue;

      // For joined children, skip indexes that reference root-only fields
      if (isJoinedChild) {
        const allChildKeys = validKeys.every(
          (k) => metadata.primaryKeys.includes(k.key) || !rootFieldKeys!.has(k.key),
        );
        if (!allChildKeys) continue;
      }

      const resolvedIndexKeys = validKeys.map((k) =>
        resolveColumnNameSafe(metadata.fields, k.key),
      );
      const autoName = `idx_${hashIdentifier(`${tableName}_${resolvedIndexKeys.join("_")}`)}`;
      const name = index.name ?? autoName;

      let where: string | null = null;
      if (index.where) {
        where = index.where;
      } else if (index.sparse) {
        where = resolvedIndexKeys
          .map((k) => `${quoteIdentifier(k)} IS NOT NULL`)
          .join(" AND ");
      }

      indexes.push({
        name,
        unique: index.unique,
        columns: validKeys.map((k) => ({
          name: resolveColumnNameSafe(metadata.fields, k.key),
          direction: k.direction,
        })),
        where,
      });
    }

    // Auto-index on discriminator column for inheritance roots
    if (
      metadata.inheritance &&
      metadata.inheritance.discriminatorValue == null &&
      metadata.inheritance.children.size > 0
    ) {
      const discrimCol = resolveColumnNameSafe(
        metadata.fields,
        metadata.inheritance.discriminatorField,
      );
      const discrimIdxName = `idx_${hashIdentifier(`${tableName}_${discrimCol}`)}`;

      if (
        !indexes.some(
          (idx) => idx.columns.length === 1 && idx.columns[0].name === discrimCol,
        )
      ) {
        indexes.push({
          name: discrimIdxName,
          unique: false,
          columns: [{ name: discrimCol, direction: "asc" }],
          where: null,
        });
      }
    }

    // Triggers — append-only triggers when entity has @AppendOnly()
    const triggers: Array<SqliteDesiredTrigger> = [];
    if (metadata.appendOnly) {
      const allStatements = generateAppendOnlyDDL(tableName);
      // SQLite append-only DDL: each statement is a CREATE TRIGGER IF NOT EXISTS
      for (const stmt of allStatements) {
        const nameMatch = stmt.match(/CREATE TRIGGER IF NOT EXISTS "([^"]+)"/);
        const triggerName = nameMatch ? nameMatch[1] : `proteus_trigger`;
        triggers.push({ name: triggerName, ddl: stmt });
      }
    }

    tables.push({
      name: tableName,
      columns,
      primaryKeys,
      foreignKeys,
      uniqueConstraints,
      checkConstraints,
      indexes,
      triggers,
    });

    // Join tables (ManyToMany)
    for (const relation of metadata.relations) {
      if (relation.type !== "ManyToMany") continue;
      if (!isString(relation.joinTable)) continue;
      if (!relation.joinKeys) continue;

      const joinScopedName = getJoinName(relation.joinTable, namespaceOptions);
      const joinTableName = joinScopedName.name;

      // Check if we already added this join table
      if (tables.some((t) => t.name === joinTableName)) {
        continue;
      }

      const foreignName = getEntityName(relation.foreignConstructor(), namespaceOptions);
      const foreignMeta = getEntityMetadata(relation.foreignConstructor());
      const inverseRelation = foreignMeta.relations.find(
        (r) =>
          r.foreignKey === relation.key &&
          r.key === relation.foreignKey &&
          r.type === "ManyToMany",
      );

      const joinColumns: Array<SqliteDesiredColumn> = [];
      const joinPkCols: Array<string> = [];
      const joinForeignKeys: Array<SqliteDesiredForeignKey> = [];
      const joinIndexes: Array<SqliteDesiredIndex> = [];
      const foreignSideCols: Array<string> = [];

      // Owner-side columns
      for (const [joinCol, ownerPk] of Object.entries(relation.joinKeys)) {
        const colType = resolveFkColumnType(() => metadata.target, ownerPk);
        joinColumns.push({
          name: joinCol,
          sqliteType: colType,
          nullable: false,
          defaultExpr: null,
          isAutoincrement: false,
          checkExpr: null,
        });
        joinPkCols.push(joinCol);

        joinForeignKeys.push({
          columns: [joinCol],
          foreignTable: entityName.name,
          foreignColumns: [resolveColumnNameSafe(metadata.fields, ownerPk)],
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        });
      }

      // Foreign-side columns
      if (inverseRelation?.joinKeys) {
        for (const [joinCol, foreignPk] of Object.entries(inverseRelation.joinKeys)) {
          const colType = resolveFkColumnType(relation.foreignConstructor, foreignPk);
          joinColumns.push({
            name: joinCol,
            sqliteType: colType,
            nullable: false,
            defaultExpr: null,
            isAutoincrement: false,
            checkExpr: null,
          });
          joinPkCols.push(joinCol);
          foreignSideCols.push(joinCol);

          joinForeignKeys.push({
            columns: [joinCol],
            foreignTable: foreignName.name,
            foreignColumns: [resolveColumnNameSafe(foreignMeta.fields, foreignPk)],
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
          });
        }
      }

      // Reverse-side index
      if (foreignSideCols.length > 0) {
        const indexName = `idx_${hashIdentifier(`${joinTableName}_${foreignSideCols.join("_")}`)}`;
        joinIndexes.push({
          name: indexName,
          unique: false,
          columns: foreignSideCols.map((c) => ({ name: c, direction: "asc" as const })),
          where: null,
        });
      }

      tables.push({
        name: joinTableName,
        columns: joinColumns,
        primaryKeys: joinPkCols,
        foreignKeys: joinForeignKeys,
        uniqueConstraints: [],
        checkConstraints: [],
        indexes: joinIndexes,
        triggers: [],
      });
    }

    // Collection tables (EmbeddedList)
    for (const embeddedList of metadata.embeddedLists ?? []) {
      const collTableName = embeddedList.tableName;

      // Check if already added
      if (tables.some((t) => t.name === collTableName)) {
        continue;
      }

      const collColumns: Array<SqliteDesiredColumn> = [];
      const collForeignKeys: Array<SqliteDesiredForeignKey> = [];
      const collIndexes: Array<SqliteDesiredIndex> = [];

      // FK column pointing to parent entity PK
      const pkField = metadata.fields.find((f) => f.key === embeddedList.parentPkColumn);
      const fkSqliteType = pkField ? mapFieldTypeSqlite(pkField) : "TEXT";

      collColumns.push({
        name: embeddedList.parentFkColumn,
        sqliteType: fkSqliteType,
        nullable: false,
        defaultExpr: null,
        isAutoincrement: false,
        checkExpr: null,
      });

      // Ordinal column
      collColumns.push({
        name: "__ordinal",
        sqliteType: "INTEGER",
        nullable: false,
        defaultExpr: null,
        isAutoincrement: false,
        checkExpr: null,
      });

      if (embeddedList.elementFields) {
        for (const field of embeddedList.elementFields) {
          const sqliteType = field.encrypted ? "TEXT" : mapFieldTypeSqlite(field);
          const checkExpr = buildEnumCheckExpr(field, field.name);
          collColumns.push({
            name: field.name,
            sqliteType,
            nullable: field.nullable,
            defaultExpr: null,
            isAutoincrement: false,
            checkExpr,
          });
        }
      } else if (embeddedList.elementType) {
        const primitiveField: MetaField = {
          key: "value",
          decorator: "Field",
          arrayType: null,
          collation: null,
          comment: null,
          computed: null,
          embedded: null,
          encrypted: null,
          enum: null,
          default: null,
          hideOn: [],
          max: null,
          min: null,
          name: "value",
          nullable: false,
          order: null,
          precision: null,
          readonly: false,
          scale: null,
          schema: null,
          transform: null,
          type: embeddedList.elementType,
        };
        const sqliteType = mapFieldTypeSqlite(primitiveField);
        collColumns.push({
          name: "value",
          sqliteType,
          nullable: false,
          defaultExpr: null,
          isAutoincrement: false,
          checkExpr: null,
        });
      }

      // FK constraint with ON DELETE CASCADE
      const parentPkColumnName = resolveColumnNameSafe(
        metadata.fields,
        embeddedList.parentPkColumn,
      );
      collForeignKeys.push({
        columns: [embeddedList.parentFkColumn],
        foreignTable: tableName,
        foreignColumns: [parentPkColumnName],
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // Index on FK column
      const idxName = `idx_${hashIdentifier(`${collTableName}_${embeddedList.parentFkColumn}`)}`;
      collIndexes.push({
        name: idxName,
        unique: false,
        columns: [{ name: embeddedList.parentFkColumn, direction: "asc" }],
        where: null,
      });

      tables.push({
        name: collTableName,
        columns: collColumns,
        primaryKeys: [embeddedList.parentFkColumn, "__ordinal"],
        foreignKeys: collForeignKeys,
        uniqueConstraints: [],
        checkConstraints: [],
        indexes: collIndexes,
        triggers: [],
      });
    }
  }

  return { tables };
};
