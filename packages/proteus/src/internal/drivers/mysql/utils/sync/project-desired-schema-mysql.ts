import { isBoolean, isNumber, isString } from "@lindorm/is";
import type {
  MysqlDesiredCheck,
  MysqlDesiredColumn,
  MysqlDesiredForeignKey,
  MysqlDesiredIndex,
  MysqlDesiredSchema,
  MysqlDesiredTable,
  MysqlDesiredUnique,
} from "../../types/desired-schema";
import type { RelationChange, RelationDestroy } from "#internal/entity/types/metadata";
import type {
  EntityMetadata,
  MetaField,
  MetaGenerated,
} from "#internal/entity/types/metadata";
import type { NamespaceOptions } from "#internal/types/types";
import { getEntityName } from "#internal/entity/utils/get-entity-name";
import { getJoinName } from "#internal/entity/utils/get-join-name";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { extractEnumValues } from "#internal/utils/extract-enum-values";
import { hashIdentifier } from "../hash-identifier";
import { mapFieldTypeMysql } from "../map-field-type-mysql";
import {
  INDEX_PREFIX_LENGTH,
  MYSQL_IDENTIFIER_LIMIT,
} from "../../constants/mysql-constants";
import { MySqlSyncError } from "../../errors/MySqlSyncError";
import { requiresIndexPrefix } from "../requires-index-prefix";
import { resolveColumnNameSafe } from "../resolve-column-name";
import { resolveFkColumnType } from "../resolve-fk-column-type";

const mapOnDeleteAction = (onDestroy: RelationDestroy): string => {
  switch (onDestroy) {
    case "cascade":
      return "CASCADE";
    case "restrict":
      return "RESTRICT";
    case "set_null":
      return "SET NULL";
    case "set_default":
      throw new MySqlSyncError("SET DEFAULT is not supported by MySQL InnoDB");
    case "ignore":
      return "NO ACTION";
    default:
      throw new MySqlSyncError(`Unsupported onDestroy value: "${onDestroy as string}"`);
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
      throw new MySqlSyncError("SET DEFAULT is not supported by MySQL InnoDB");
    case "ignore":
      return "NO ACTION";
    default:
      throw new MySqlSyncError(`Unsupported onUpdate value: "${onUpdate as string}"`);
  }
};

const buildEnumValues = (field: MetaField): Array<string> | null => {
  if (field.type !== "enum" || !field.enum) return null;
  const values = extractEnumValues(field.enum);
  return values.length > 0 ? values : null;
};

const projectFieldColumn = (
  field: MetaField,
  generated: Array<MetaGenerated>,
): MysqlDesiredColumn => {
  const gen = generated.find((g) => g.key === field.key);
  const enumValues = buildEnumValues(field);

  let mysqlType: string;
  if (field.encrypted) {
    mysqlType = "text";
  } else if (enumValues) {
    const escaped = enumValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
    mysqlType = `enum(${escaped})`;
  } else {
    mysqlType = mapFieldTypeMysql(field).toLowerCase();
  }

  let defaultExpr: string | null = null;
  let isAutoIncrement = false;

  if (field.computed) {
    // Computed columns have no default or auto-increment
  } else if (gen?.strategy === "increment") {
    isAutoIncrement = true;
  } else if (gen?.strategy === "uuid") {
    // UUID generated app-side; no default in MySQL
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

  return {
    name: field.name,
    mysqlType,
    nullable: field.embedded ? true : field.nullable,
    defaultExpr,
    isAutoIncrement,
    enumValues,
    computed: field.computed ?? null,
  };
};

const projectFkColumn = (
  joinCol: string,
  foreignPkKey: string,
  foreignConstructor: () => any,
  nullable = false,
): MysqlDesiredColumn => {
  const mysqlType = resolveFkColumnType(foreignConstructor, foreignPkKey).toLowerCase();

  return {
    name: joinCol,
    mysqlType,
    nullable,
    defaultExpr: null,
    isAutoIncrement: false,
    enumValues: null,
  };
};

/**
 * Projects entity metadata into a `MysqlDesiredSchema` structure for comparison with
 * the DB snapshot. Handles tables, columns (including FK and embedded), constraints
 * (PK, UNIQUE, CHECK, FK), indexes, and ManyToMany join tables.
 *
 * MySQL differences from PG/SQLite:
 * - No schema qualification (database is specified in connection)
 * - Enum values are part of the column type (ENUM('a','b','c'))
 * - AUTO_INCREMENT instead of AUTOINCREMENT/GENERATED
 * - Named FK constraints with hash-based names
 * - TEXT/BLOB columns need prefix lengths for indexing
 */
export const projectDesiredSchemaMysql = (
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
): MysqlDesiredSchema => {
  const tables: Array<MysqlDesiredTable> = [];

  for (const metadata of metadataList) {
    // Skip child entities in single-table inheritance
    if (
      metadata.inheritance?.strategy === "single-table" &&
      metadata.inheritance.discriminatorValue != null
    ) {
      continue;
    }

    const isJoinedChild =
      metadata.inheritance?.strategy === "joined" &&
      metadata.inheritance.discriminatorValue != null;

    let rootFieldKeys: Set<string> | null = null;
    let rootEntityName: ReturnType<typeof getEntityName> | null = null;
    if (isJoinedChild) {
      const rootMeta = getEntityMetadata(metadata.inheritance!.root);
      rootFieldKeys = new Set(rootMeta.fields.map((f) => f.key));
      rootEntityName = getEntityName(metadata.inheritance!.root, namespaceOptions);
    }

    const entityName = getEntityName(metadata.target, namespaceOptions);
    const tableName = entityName.name;

    const effectiveFields = isJoinedChild
      ? metadata.fields.filter(
          (f) => metadata.primaryKeys.includes(f.key) || !rootFieldKeys!.has(f.key),
        )
      : metadata.fields;

    // Validate column names
    for (const field of effectiveFields) {
      if (field.name.length > MYSQL_IDENTIFIER_LIMIT) {
        throw new MySqlSyncError(
          `Column name "${field.name}" on "${metadata.target.name}" exceeds ${MYSQL_IDENTIFIER_LIMIT} characters`,
        );
      }
    }

    // Columns
    const columns: Array<MysqlDesiredColumn> = [];
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
        columns.push(
          projectFkColumn(
            joinCol,
            foreignPk,
            relation.foreignConstructor,
            relation.options.nullable,
          ),
        );
        fkColumnNames.push(joinCol);
      }
    }

    // Validate embedded/FK column name collisions
    for (const fkCol of fkColumnNames) {
      const colliding = effectiveFields.find((f) => f.embedded && f.name === fkCol);
      if (colliding) {
        throw new MySqlSyncError(
          `Column name "${fkCol}" on "${metadata.target.name}" collides — embedded field "${colliding.key}" produces column "${colliding.name}" which conflicts with a relation FK column of the same name`,
        );
      }
    }

    // Primary keys
    const primaryKeys = metadata.primaryKeys.map((k) =>
      resolveColumnNameSafe(metadata.fields, k),
    );

    // Foreign keys
    const foreignKeys: Array<MysqlDesiredForeignKey> = [];

    // For joined children, add FK: child PK -> root PK
    if (isJoinedChild && rootEntityName) {
      const rootMeta = getEntityMetadata(metadata.inheritance!.root);
      const pkColumns = metadata.primaryKeys.map((k) =>
        resolveColumnNameSafe(metadata.fields, k),
      );
      const rootPkColumns = rootMeta.primaryKeys.map((k) =>
        resolveColumnNameSafe(rootMeta.fields, k),
      );
      const constraintName = `fk_${hashIdentifier(`${tableName}_${pkColumns.join("_")}_${rootEntityName.name}_${rootPkColumns.join("_")}`)}`;

      foreignKeys.push({
        constraintName,
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
        const constraintName = `fk_${hashIdentifier(`${tableName}_${resolvedJoinCol}_${foreignName.name}_${resolvedForeignPk}`)}`;

        foreignKeys.push({
          constraintName,
          columns: [resolvedJoinCol],
          foreignTable: foreignName.name,
          foreignColumns: [resolvedForeignPk],
          onDelete,
          onUpdate,
        });
      }
    }

    // Unique constraints
    const uniqueConstraints: Array<MysqlDesiredUnique> = [];
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
      uniqueConstraints.push({
        name,
        columns: resolvedUniqueKeys.map((colName) => {
          const field = metadata.fields.find(
            (f) => f.name === colName || f.key === colName,
          );
          return {
            name: colName,
            prefixLength: requiresIndexPrefix(field) ? INDEX_PREFIX_LENGTH : null,
          };
        }),
      });
    }

    // Check constraints
    const checkConstraints: Array<MysqlDesiredCheck> = [];
    for (const check of metadata.checks) {
      const name =
        check.name ?? `chk_${hashIdentifier(`${tableName}_${check.expression}`)}`;
      checkConstraints.push({ name, expression: check.expression });
    }

    // Indexes
    const indexes: Array<MysqlDesiredIndex> = [];
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

      indexes.push({
        name,
        unique: index.unique,
        columns: validKeys.map((k) => {
          const colName = resolveColumnNameSafe(metadata.fields, k.key);
          const field = metadata.fields.find(
            (f) => f.name === colName || f.key === k.key,
          );
          const prefixLength = requiresIndexPrefix(field) ? INDEX_PREFIX_LENGTH : null;
          return { name: colName, direction: k.direction, prefixLength };
        }),
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
      const discrimField = metadata.fields.find(
        (f) =>
          f.name === discrimCol || f.key === metadata.inheritance!.discriminatorField,
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
          columns: [
            {
              name: discrimCol,
              direction: "asc",
              prefixLength: requiresIndexPrefix(discrimField)
                ? INDEX_PREFIX_LENGTH
                : null,
            },
          ],
        });
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
    });

    // Join tables (ManyToMany)
    for (const relation of metadata.relations) {
      if (relation.type !== "ManyToMany") continue;
      if (!isString(relation.joinTable)) continue;
      if (!relation.joinKeys) continue;

      const joinScopedName = getJoinName(relation.joinTable, namespaceOptions);
      const joinTableName = joinScopedName.name;

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

      const joinColumns: Array<MysqlDesiredColumn> = [];
      const joinPkCols: Array<string> = [];
      const joinForeignKeys: Array<MysqlDesiredForeignKey> = [];
      const joinIndexes: Array<MysqlDesiredIndex> = [];
      const foreignSideCols: Array<string> = [];

      // Owner-side columns
      for (const [joinCol, ownerPk] of Object.entries(relation.joinKeys)) {
        const colType = resolveFkColumnType(() => metadata.target, ownerPk).toLowerCase();
        joinColumns.push({
          name: joinCol,
          mysqlType: colType,
          nullable: false,
          defaultExpr: null,
          isAutoIncrement: false,
          enumValues: null,
        });
        joinPkCols.push(joinCol);

        const resolvedOwnerPk = resolveColumnNameSafe(metadata.fields, ownerPk);
        const fkName = `fk_${hashIdentifier(`${joinTableName}_${joinCol}_${entityName.name}_${resolvedOwnerPk}`)}`;
        joinForeignKeys.push({
          constraintName: fkName,
          columns: [joinCol],
          foreignTable: entityName.name,
          foreignColumns: [resolvedOwnerPk],
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
        });
      }

      // Foreign-side columns
      if (inverseRelation?.joinKeys) {
        for (const [joinCol, foreignPk] of Object.entries(inverseRelation.joinKeys)) {
          const colType = resolveFkColumnType(
            relation.foreignConstructor,
            foreignPk,
          ).toLowerCase();
          joinColumns.push({
            name: joinCol,
            mysqlType: colType,
            nullable: false,
            defaultExpr: null,
            isAutoIncrement: false,
            enumValues: null,
          });
          joinPkCols.push(joinCol);
          foreignSideCols.push(joinCol);

          const resolvedForeignPk = resolveColumnNameSafe(foreignMeta.fields, foreignPk);
          const fkName = `fk_${hashIdentifier(`${joinTableName}_${joinCol}_${foreignName.name}_${resolvedForeignPk}`)}`;
          joinForeignKeys.push({
            constraintName: fkName,
            columns: [joinCol],
            foreignTable: foreignName.name,
            foreignColumns: [resolvedForeignPk],
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
          columns: foreignSideCols.map((c) => ({
            name: c,
            direction: "asc" as const,
            prefixLength: null,
          })),
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
      });
    }

    // Collection tables (EmbeddedList)
    for (const embeddedList of metadata.embeddedLists ?? []) {
      const collTableName = embeddedList.tableName;

      if (tables.some((t) => t.name === collTableName)) {
        continue;
      }

      const collColumns: Array<MysqlDesiredColumn> = [];
      const collForeignKeys: Array<MysqlDesiredForeignKey> = [];
      const collIndexes: Array<MysqlDesiredIndex> = [];

      // FK column pointing to parent entity PK
      const pkField = metadata.fields.find((f) => f.key === embeddedList.parentPkColumn);
      const fkMysqlType = pkField
        ? mapFieldTypeMysql(pkField).toLowerCase()
        : "varchar(255)";

      collColumns.push({
        name: embeddedList.parentFkColumn,
        mysqlType: fkMysqlType,
        nullable: false,
        defaultExpr: null,
        isAutoIncrement: false,
        enumValues: null,
      });

      // Ordinal column
      collColumns.push({
        name: "__ordinal",
        mysqlType: "int",
        nullable: false,
        defaultExpr: null,
        isAutoIncrement: false,
        enumValues: null,
      });

      if (embeddedList.elementFields) {
        for (const field of embeddedList.elementFields) {
          const enumValues = buildEnumValues(field);
          let mysqlType: string;
          if (field.encrypted) {
            mysqlType = "text";
          } else if (enumValues) {
            const escaped = enumValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
            mysqlType = `enum(${escaped})`;
          } else {
            mysqlType = mapFieldTypeMysql(field).toLowerCase();
          }
          collColumns.push({
            name: field.name,
            mysqlType,
            nullable: field.nullable,
            defaultExpr: null,
            isAutoIncrement: false,
            enumValues,
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
        const mysqlType = mapFieldTypeMysql(primitiveField).toLowerCase();
        collColumns.push({
          name: "value",
          mysqlType,
          nullable: false,
          defaultExpr: null,
          isAutoIncrement: false,
          enumValues: null,
        });
      }

      // FK constraint with ON DELETE CASCADE
      const parentPkColumnName = resolveColumnNameSafe(
        metadata.fields,
        embeddedList.parentPkColumn,
      );
      const fkName = `fk_${hashIdentifier(`${collTableName}_${embeddedList.parentFkColumn}_${tableName}_${parentPkColumnName}`)}`;
      collForeignKeys.push({
        constraintName: fkName,
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
        columns: [
          { name: embeddedList.parentFkColumn, direction: "asc", prefixLength: null },
        ],
      });

      tables.push({
        name: collTableName,
        columns: collColumns,
        primaryKeys: [embeddedList.parentFkColumn, "__ordinal"],
        foreignKeys: collForeignKeys,
        uniqueConstraints: [],
        checkConstraints: [],
        indexes: collIndexes,
      });
    }
  }

  return { tables };
};
