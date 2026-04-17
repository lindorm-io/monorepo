import { isBoolean, isNumber, isString } from "@lindorm/is";
import type {
  DesiredColumn,
  DesiredConstraint,
  DesiredEnum,
  DesiredIndex,
  DesiredSchema,
  DesiredTable,
  DesiredTrigger,
} from "../../types/desired-schema";
import type { RelationChange, RelationDestroy } from "../../../../entity/types/metadata";
import type {
  EntityMetadata,
  MetaField,
  MetaGenerated,
} from "../../../../entity/types/metadata";
import type { NamespaceOptions } from "../../../../types/types";
import { getEntityName } from "../../../../entity/utils/get-entity-name";
import { getJoinName } from "../../../../entity/utils/get-join-name";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata";
import { generateAppendOnlyDDL } from "../ddl/generate-append-only-ddl";
import { extractEnumValues } from "../extract-enum-values";
import { getEnumTypeName } from "../get-enum-type-name";
import { hashIdentifier } from "../hash-identifier";
import { mapFieldType } from "../map-field-type";
import { PG_IDENTIFIER_LIMIT } from "../../constants/postgres-constants";
import { PostgresSyncError } from "../../errors/PostgresSyncError";
import { quoteIdentifier } from "../quote-identifier";
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
      return "SET DEFAULT";
    case "ignore":
      return "NO ACTION";
    default:
      throw new PostgresSyncError(
        `Unsupported onDestroy value: "${onDestroy as string}"`,
      );
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
      throw new PostgresSyncError(`Unsupported onUpdate value: "${onUpdate as string}"`);
  }
};

const projectFieldColumn = (
  field: MetaField,
  generated: Array<MetaGenerated>,
  tableName: string,
  namespace: string | null,
): DesiredColumn => {
  const pgType = field.encrypted ? "text" : mapFieldType(field, tableName, namespace);
  const gen = generated.find((g) => g.key === field.key);

  let defaultExpr: string | null = null;
  let isIdentity = false;
  let identityGeneration: DesiredColumn["identityGeneration"] = null;
  let isGenerated = false;
  let generationExpr: string | null = null;

  if (field.computed) {
    isGenerated = true;
    generationExpr = field.computed;
  } else if (gen?.strategy === "increment" || gen?.strategy === "identity") {
    isIdentity = true;
    identityGeneration = "ALWAYS";
  } else if (gen?.strategy === "uuid") {
    defaultExpr = "gen_random_uuid()";
  } else if (field.default !== null && typeof field.default !== "function") {
    const d = field.default;
    if (isString(d)) {
      defaultExpr = `'${d.replace(/'/g, "''")}'`;
    } else if (isNumber(d) || typeof d === "bigint") {
      defaultExpr = `${d}`;
    } else if (isBoolean(d)) {
      defaultExpr = `${d}`;
    }
  }

  return {
    name: field.name,
    pgType,
    // Embedded child columns must always be nullable in the DDL because the
    // parent object can be null — even when the child's own @Field is non-nullable.
    // The non-nullable constraint for children is enforced by Zod validation at
    // the application layer (when the parent IS present, child fields are required).
    nullable: field.embedded ? true : field.nullable,
    defaultExpr,
    isIdentity,
    identityGeneration,
    isGenerated,
    generationExpr,
    collation: field.collation,
  };
};

const projectFkColumn = (
  joinCol: string,
  foreignPkKey: string,
  foreignConstructor: () => any,
  nullable: boolean,
  namespaceOptions: NamespaceOptions,
): DesiredColumn => {
  const pgType = resolveFkColumnType(foreignConstructor, foreignPkKey, namespaceOptions);

  return {
    name: joinCol,
    pgType,
    nullable,
    defaultExpr: null,
    isIdentity: false,
    identityGeneration: null,
    isGenerated: false,
    generationExpr: null,
    collation: null,
  };
};

/**
 * Projects entity metadata into a `DesiredSchema` structure for comparison with the
 * DB snapshot. Handles extensions, schemas, enum types (with deduplication), tables,
 * columns (including FK and embedded), constraints (PK, UNIQUE, CHECK, FK), indexes,
 * comments, and ManyToMany join tables. FK columns from owning-side relations are
 * auto-generated unless a non-embedded field with the same column name exists.
 */
export const projectDesiredSchema = (
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
): DesiredSchema => {
  const tables: Array<DesiredTable> = [];
  const enums: Array<DesiredEnum> = [];
  const enumSet = new Set<string>();
  const schemaSet = new Set<string>();
  const extensionSet = new Set<string>();

  for (const metadata of metadataList) {
    // Skip child entities in single-table inheritance — the root entity's projection
    // already includes all subtype fields (merged by mergeSingleTableSubtypeFields).
    if (
      metadata.inheritance?.strategy === "single-table" &&
      metadata.inheritance.discriminatorValue != null
    ) {
      continue;
    }

    // Determine if this is a joined child entity. Joined children get their own
    // table with ONLY child-specific fields + PK (which is also FK to root).
    const isJoinedChild =
      metadata.inheritance?.strategy === "joined" &&
      metadata.inheritance.discriminatorValue != null;

    // For joined children, compute the set of root field keys so we can partition
    // fields into "root" (excluded from child table) and "child-only" (included).
    let rootFieldKeys: Set<string> | null = null;
    let rootEntityName: ReturnType<typeof getEntityName> | null = null;
    if (isJoinedChild) {
      const rootMeta = getEntityMetadata(metadata.inheritance!.root);
      rootFieldKeys = new Set(rootMeta.fields.map((f) => f.key));
      rootEntityName = getEntityName(metadata.inheritance!.root, namespaceOptions);
    }

    const entityName = getEntityName(metadata.target, namespaceOptions);
    const { namespace, name: tableName } = entityName;

    if (namespace) schemaSet.add(namespace);

    // For joined children, only validate/process child-specific fields + PK fields.
    // The root fields are managed by the root entity's table projection.
    const effectiveFields = isJoinedChild
      ? metadata.fields.filter(
          (f) => metadata.primaryKeys.includes(f.key) || !rootFieldKeys!.has(f.key),
        )
      : metadata.fields;

    // Validate column names against PG identifier limit
    for (const field of effectiveFields) {
      if (field.name.length > PG_IDENTIFIER_LIMIT) {
        throw new PostgresSyncError(
          `Column name "${field.name}" on "${metadata.target.name}" exceeds ${PG_IDENTIFIER_LIMIT} characters`,
        );
      }
    }

    // Extensions
    if (effectiveFields.some((f) => f.type === "vector")) {
      extensionSet.add("vector");
    }

    // Enums (deduplicated by schema + name)
    for (const field of effectiveFields) {
      if (field.type !== "enum" || !field.enum) continue;
      const enumSchema = namespace ?? "public";
      const enumName = getEnumTypeName(tableName, field.name);
      const enumKey = `${enumSchema}.${enumName}`;
      if (enumSet.has(enumKey)) continue;
      enumSet.add(enumKey);
      enums.push({
        schema: enumSchema,
        name: enumName,
        values: extractEnumValues(field.enum),
      });
    }

    // Columns
    const columns: Array<DesiredColumn> = [];
    for (const field of effectiveFields) {
      columns.push(projectFieldColumn(field, metadata.generated, tableName, namespace));
    }

    // FK columns from owning-side relations
    // For joined children, skip relations whose FK columns belong to the root table
    const fkColumnNames: Array<string> = [];
    for (const relation of metadata.relations) {
      if (!relation.joinKeys) continue;
      if (relation.type === "ManyToMany") continue;
      for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
        // For joined children, skip FK columns that belong to root fields
        if (isJoinedChild && rootFieldKeys!.has(joinCol)) continue;
        if (effectiveFields.some((f) => !f.embedded && f.name === joinCol)) continue;
        columns.push(
          projectFkColumn(
            joinCol,
            foreignPk,
            relation.foreignConstructor,
            relation.options.nullable,
            namespaceOptions,
          ),
        );
        fkColumnNames.push(joinCol);
      }
    }

    // Validate: embedded flat column names must not collide with FK column names.
    // validateFields runs before FK columns are added by resolveRelations, so
    // collisions between embedded columns (e.g. "user_id") and relation FK
    // columns (e.g. "user_id") are only detectable here.
    for (const fkCol of fkColumnNames) {
      const colliding = effectiveFields.find((f) => f.embedded && f.name === fkCol);
      if (colliding) {
        throw new PostgresSyncError(
          `Column name "${fkCol}" on "${metadata.target.name}" collides — embedded field "${colliding.key}" produces column "${colliding.name}" which conflicts with a relation FK column of the same name`,
        );
      }
    }

    // Constraints
    const constraints: Array<DesiredConstraint> = [];

    // PK
    const pkName = `${tableName}_pkey`;
    constraints.push({
      name: pkName,
      type: "PRIMARY KEY",
      columns: metadata.primaryKeys.map((k) => resolveColumnNameSafe(metadata.fields, k)),
      foreignSchema: null,
      foreignTable: null,
      foreignColumns: null,
      onDelete: null,
      onUpdate: null,
      checkExpr: null,
      deferrable: false,
      initiallyDeferred: false,
    });

    // For joined children, add FK constraint: child PK → root PK with ON DELETE CASCADE.
    // This links the child table's primary key to the root table, ensuring referential
    // integrity and cascading deletes from root to child.
    if (isJoinedChild && rootEntityName) {
      const rootMeta = getEntityMetadata(metadata.inheritance!.root);
      const pkColumns = metadata.primaryKeys.map((k) =>
        resolveColumnNameSafe(metadata.fields, k),
      );
      const rootPkColumns = rootMeta.primaryKeys.map((k) =>
        resolveColumnNameSafe(rootMeta.fields, k),
      );
      const inhFkName = `fk_${hashIdentifier(`${tableName}_inh_${rootEntityName.name}`)}`;

      constraints.push({
        name: inhFkName,
        type: "FOREIGN KEY",
        columns: pkColumns,
        foreignSchema: rootEntityName.namespace ?? "public",
        foreignTable: rootEntityName.name,
        foreignColumns: rootPkColumns,
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
        checkExpr: null,
        deferrable: false,
        initiallyDeferred: false,
      });
    }

    // Uniques — for joined children, only project uniques whose keys are all child-specific
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
      constraints.push({
        name,
        type: "UNIQUE",
        columns: resolvedUniqueKeys,
        foreignSchema: null,
        foreignTable: null,
        foreignColumns: null,
        onDelete: null,
        onUpdate: null,
        checkExpr: null,
        deferrable: false,
        initiallyDeferred: false,
      });
    }

    // Checks — for joined children, include all checks (they may reference child columns)
    for (const check of metadata.checks) {
      const name =
        check.name ?? `chk_${hashIdentifier(`${tableName}_${check.expression}`)}`;
      constraints.push({
        name,
        type: "CHECK",
        columns: [],
        foreignSchema: null,
        foreignTable: null,
        foreignColumns: null,
        onDelete: null,
        onUpdate: null,
        checkExpr: `CHECK (${check.expression})`,
        deferrable: false,
        initiallyDeferred: false,
      });
    }

    // FK constraints from relations
    // For joined children, skip FK constraints whose join columns belong to root fields
    for (const relation of metadata.relations) {
      if (!relation.joinKeys) continue;
      if (relation.type === "ManyToMany") continue;

      const foreignName = getEntityName(relation.foreignConstructor(), namespaceOptions);

      const foreignMeta = getEntityMetadata(relation.foreignConstructor());
      for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
        // For joined children, skip FK constraints that belong to root table
        if (isJoinedChild && rootFieldKeys!.has(joinCol)) continue;

        const resolvedJoinCol = resolveColumnNameSafe(metadata.fields, joinCol);
        const resolvedForeignPk = resolveColumnNameSafe(foreignMeta.fields, foreignPk);
        const constraintName = `fk_${hashIdentifier(`${tableName}_${resolvedJoinCol}`)}`;
        const onDelete = mapOnDeleteAction(relation.options.onDestroy);
        const onUpdate = mapOnUpdateAction(relation.options.onUpdate);

        constraints.push({
          name: constraintName,
          type: "FOREIGN KEY",
          columns: [resolvedJoinCol],
          foreignSchema: foreignName.namespace ?? "public",
          foreignTable: foreignName.name,
          foreignColumns: [resolvedForeignPk],
          onDelete,
          onUpdate,
          checkExpr: null,
          deferrable: relation.options.deferrable,
          initiallyDeferred: relation.options.initiallyDeferred,
        });
      }
    }

    // Indexes
    // For joined children, only project indexes whose keys are all on the child table
    const indexes: Array<DesiredIndex> = [];
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
      const method = index.using?.toLowerCase() ?? "btree";

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
        method,
        where,
        include:
          index.include?.map((k) => resolveColumnNameSafe(metadata.fields, k)) ?? null,
        concurrent: index.concurrent,
      });
    }

    // Auto-index on discriminator column for inheritance roots (both single-table and joined).
    // This accelerates queries that filter by subtype (i.e. the __discriminator filter).
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

      // Only add if no user-defined index already covers this column
      if (
        !indexes.some(
          (idx) => idx.columns.length === 1 && idx.columns[0].name === discrimCol,
        )
      ) {
        indexes.push({
          name: discrimIdxName,
          unique: false,
          columns: [{ name: discrimCol, direction: "asc" }],
          method: "btree",
          where: null,
          include: null,
          concurrent: false,
        });
      }
    }

    // Comments — use effectiveFields for joined children
    const columnComments: Record<string, string> = {};
    for (const field of effectiveFields) {
      if (field.comment) {
        columnComments[field.name] = field.comment;
      }
    }

    // Triggers — append-only triggers when entity has @AppendOnly()
    const triggers: Array<DesiredTrigger> = [];
    if (metadata.appendOnly) {
      const allStatements = generateAppendOnlyDDL(tableName, namespace);
      // First statement is the shared guard function (CREATE OR REPLACE FUNCTION).
      // Remaining statements are per-trigger: DROP IF EXISTS + CREATE pairs.
      const guardFunctionStmt = allStatements[0];
      const perTriggerStmts = allStatements.slice(1);

      // Per-trigger statements come in pairs: DROP IF EXISTS, then CREATE TRIGGER.
      for (let i = 0; i < perTriggerStmts.length; i += 2) {
        const dropStmt = perTriggerStmts[i];
        const createStmt = perTriggerStmts[i + 1];
        // Extract trigger name from CREATE TRIGGER "name"
        const nameMatch = createStmt.match(/CREATE TRIGGER "([^"]+)"/);
        const triggerName = nameMatch ? nameMatch[1] : `proteus_trigger_${i}`;

        // Include guard function in first trigger's statements (idempotent)
        const stmts =
          i === 0 ? [guardFunctionStmt, dropStmt, createStmt] : [dropStmt, createStmt];

        triggers.push({ name: triggerName, statements: stmts });
      }
    }

    tables.push({
      schema: namespace ?? "public",
      name: tableName,
      columns,
      constraints,
      indexes,
      comment: metadata.entity.comment ?? null,
      columnComments,
      triggers,
    });

    // Join tables (ManyToMany)
    for (const relation of metadata.relations) {
      if (relation.type !== "ManyToMany") continue;
      if (!isString(relation.joinTable)) continue;
      if (!relation.joinKeys) continue;

      const joinScopedName = getJoinName(relation.joinTable, namespaceOptions);
      const joinTableName = joinScopedName.name;
      const joinNamespace = joinScopedName.namespace;

      if (joinNamespace) schemaSet.add(joinNamespace);

      // Check if we already added this join table (both sides of M2M add it)
      if (
        tables.some(
          (t) => t.name === joinTableName && t.schema === (joinNamespace ?? "public"),
        )
      ) {
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

      const joinColumns: Array<DesiredColumn> = [];
      const joinPkCols: Array<string> = [];
      const joinConstraints: Array<DesiredConstraint> = [];
      const joinIndexes: Array<DesiredIndex> = [];
      const foreignSideCols: Array<string> = [];

      // Owner-side columns
      for (const [joinCol, ownerPk] of Object.entries(relation.joinKeys)) {
        const colType = resolveFkColumnType(
          () => metadata.target,
          ownerPk,
          namespaceOptions,
        );
        joinColumns.push({
          name: joinCol,
          pgType: colType,
          nullable: false,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        });
        joinPkCols.push(joinCol);
      }

      // Foreign-side columns
      if (inverseRelation?.joinKeys) {
        for (const [joinCol, foreignPk] of Object.entries(inverseRelation.joinKeys)) {
          const colType = resolveFkColumnType(
            relation.foreignConstructor,
            foreignPk,
            namespaceOptions,
          );
          joinColumns.push({
            name: joinCol,
            pgType: colType,
            nullable: false,
            defaultExpr: null,
            isIdentity: false,
            identityGeneration: null,
            isGenerated: false,
            generationExpr: null,
            collation: null,
          });
          joinPkCols.push(joinCol);
          foreignSideCols.push(joinCol);
        }
      }

      // PK constraint
      joinConstraints.push({
        name: `${joinTableName}_pkey`,
        type: "PRIMARY KEY",
        columns: joinPkCols,
        foreignSchema: null,
        foreignTable: null,
        foreignColumns: null,
        onDelete: null,
        onUpdate: null,
        checkExpr: null,
        deferrable: false,
        initiallyDeferred: false,
      });

      // FK constraints for join table
      for (const [joinCol, ownerPk] of Object.entries(relation.joinKeys)) {
        const fkName = `fk_${hashIdentifier(`${joinTableName}_${joinCol}`)}`;
        joinConstraints.push({
          name: fkName,
          type: "FOREIGN KEY",
          columns: [joinCol],
          foreignSchema: namespace ?? "public",
          foreignTable: entityName.name,
          foreignColumns: [resolveColumnNameSafe(metadata.fields, ownerPk)],
          onDelete: "CASCADE",
          onUpdate: "CASCADE",
          checkExpr: null,
          deferrable: false,
          initiallyDeferred: false,
        });
      }

      if (inverseRelation?.joinKeys) {
        for (const [joinCol, foreignPk] of Object.entries(inverseRelation.joinKeys)) {
          const fkName = `fk_${hashIdentifier(`${joinTableName}_${joinCol}`)}`;
          joinConstraints.push({
            name: fkName,
            type: "FOREIGN KEY",
            columns: [joinCol],
            foreignSchema: foreignName.namespace ?? "public",
            foreignTable: foreignName.name,
            foreignColumns: [resolveColumnNameSafe(foreignMeta.fields, foreignPk)],
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
            checkExpr: null,
            deferrable: false,
            initiallyDeferred: false,
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
          method: "btree",
          where: null,
          include: null,
          concurrent: false,
        });
      }

      tables.push({
        schema: joinNamespace ?? "public",
        name: joinTableName,
        columns: joinColumns,
        constraints: joinConstraints,
        indexes: joinIndexes,
        comment: null,
        columnComments: {},
        triggers: [],
      });
    }

    // Collection tables (EmbeddedList)
    for (const embeddedList of metadata.embeddedLists ?? []) {
      const collTableName = embeddedList.tableName;
      const collNamespace = namespace;

      if (collNamespace) schemaSet.add(collNamespace);

      // Check if already added (shouldn't happen, but be safe)
      if (
        tables.some(
          (t) => t.name === collTableName && t.schema === (collNamespace ?? "public"),
        )
      ) {
        continue;
      }

      const collColumns: Array<DesiredColumn> = [];
      const collConstraints: Array<DesiredConstraint> = [];
      const collIndexes: Array<DesiredIndex> = [];

      // FK column pointing to parent entity PK
      const pkField = metadata.fields.find((f) => f.key === embeddedList.parentPkColumn);
      const fkPgType = pkField
        ? mapFieldType(pkField, collTableName, collNamespace)
        : "UUID";

      collColumns.push({
        name: embeddedList.parentFkColumn,
        pgType: fkPgType,
        nullable: false,
        defaultExpr: null,
        isIdentity: false,
        identityGeneration: null,
        isGenerated: false,
        generationExpr: null,
        collation: null,
      });

      // Ordinal column — preserves array element ordering across delete+insert cycles
      collColumns.push({
        name: "__ordinal",
        pgType: "INTEGER",
        nullable: false,
        defaultExpr: null,
        isIdentity: false,
        identityGeneration: null,
        isGenerated: false,
        generationExpr: null,
        collation: null,
      });

      if (embeddedList.elementFields) {
        // Embeddable element: one column per field
        for (const field of embeddedList.elementFields) {
          const pgType = field.encrypted
            ? "text"
            : mapFieldType(field, collTableName, collNamespace);
          collColumns.push({
            name: field.name,
            pgType,
            nullable: field.nullable,
            defaultExpr: null,
            isIdentity: false,
            identityGeneration: null,
            isGenerated: false,
            generationExpr: null,
            collation: field.collation,
          });

          // Enums within embeddable fields (deduplicated)
          if (field.type === "enum" && field.enum) {
            const collEnumSchema = collNamespace ?? "public";
            const enumName = getEnumTypeName(collTableName, field.name);
            const enumKey = `${collEnumSchema}.${enumName}`;
            if (!enumSet.has(enumKey)) {
              enumSet.add(enumKey);
              enums.push({
                schema: collEnumSchema,
                name: enumName,
                values: extractEnumValues(field.enum),
              });
            }
          }
        }
      } else if (embeddedList.elementType) {
        // Primitive element: single "value" column
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
        const pgType = mapFieldType(primitiveField, collTableName, collNamespace);
        collColumns.push({
          name: "value",
          pgType,
          nullable: false,
          defaultExpr: null,
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        });
      }

      // FK constraint with ON DELETE CASCADE
      const fkName = `fk_${hashIdentifier(`${collTableName}_${embeddedList.parentFkColumn}`)}`;
      const parentPkColumnName = resolveColumnNameSafe(
        metadata.fields,
        embeddedList.parentPkColumn,
      );

      collConstraints.push({
        name: fkName,
        type: "FOREIGN KEY",
        columns: [embeddedList.parentFkColumn],
        foreignSchema: namespace ?? "public",
        foreignTable: tableName,
        foreignColumns: [parentPkColumnName],
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
        checkExpr: null,
        deferrable: false,
        initiallyDeferred: false,
      });

      // Index on FK column for efficient lookups
      const idxName = `idx_${hashIdentifier(`${collTableName}_${embeddedList.parentFkColumn}`)}`;
      collIndexes.push({
        name: idxName,
        unique: false,
        columns: [{ name: embeddedList.parentFkColumn, direction: "asc" }],
        method: "btree",
        where: null,
        include: null,
        concurrent: false,
      });

      tables.push({
        schema: collNamespace ?? "public",
        name: collTableName,
        columns: collColumns,
        constraints: collConstraints,
        indexes: collIndexes,
        comment: null,
        columnComments: {},
        triggers: [],
      });
    }
  }

  return {
    tables,
    enums,
    schemas: Array.from(schemaSet),
    extensions: Array.from(extensionSet),
  };
};
