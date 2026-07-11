import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../types/types.js";
import type {
  DesiredCheckModel,
  DesiredForeignKeyModel,
  DesiredPrimaryKeyModel,
  DesiredUniqueModel,
} from "./desired-schema-model.js";
import type { JoinedChildContext } from "./joined-child-context.js";
import type { SyncDialect } from "./sync-dialect.js";
import { getEntityName } from "../../entity/utils/get-entity-name.js";
import { getForeignMetadata } from "../../entity/metadata/foreign-metadata.js";
import {
  buildCheckName,
  buildForeignKeyName,
  buildInheritanceForeignKeyName,
  buildUniqueName,
} from "../sql/constraint-names.js";
import { resolveColumnNameSafe } from "../sql/resolve-column-name.js";

export type ProjectConstraintsOptions = {
  metadata: EntityMetadata;
  child: JoinedChildContext;
  tableName: string;
  dialect: SyncDialect;
  namespaceOptions: NamespaceOptions;
};

export type ProjectedConstraints = {
  primaryKey: DesiredPrimaryKeyModel;
  foreignKeys: Array<DesiredForeignKeyModel>;
  uniques: Array<DesiredUniqueModel>;
  checks: Array<DesiredCheckModel>;
};

/**
 * Projects an entity table's constraints: primary key, the joined-child
 * inheritance FK (child PK → root PK, ON DELETE CASCADE), uniques (child-only
 * keys for joined children), checks (always all — they may reference child
 * columns), and owning-side relation FKs.
 */
export const projectConstraints = (
  options: ProjectConstraintsOptions,
): ProjectedConstraints => {
  const { metadata, child, tableName, dialect, namespaceOptions } = options;

  const primaryKey: DesiredPrimaryKeyModel = {
    columns: metadata.primaryKeys.map((k) => resolveColumnNameSafe(metadata.fields, k)),
  };

  const foreignKeys: Array<DesiredForeignKeyModel> = [];

  // For joined children, add FK constraint: child PK → root PK with ON DELETE
  // CASCADE. This links the child table's primary key to the root table,
  // ensuring referential integrity and cascading deletes from root to child.
  if (child.isJoinedChild && child.rootEntityName) {
    const rootMeta = child.rootMeta!;
    const pkColumns = metadata.primaryKeys.map((k) =>
      resolveColumnNameSafe(metadata.fields, k),
    );
    const rootPkColumns = rootMeta.primaryKeys.map((k) =>
      resolveColumnNameSafe(rootMeta.fields, k),
    );

    foreignKeys.push({
      kind: "inheritance",
      name: dialect.namedForeignKeys
        ? buildInheritanceForeignKeyName(tableName, child.rootEntityName.name)
        : null,
      columns: pkColumns,
      foreignNamespace: child.rootEntityName.namespace,
      foreignTable: child.rootEntityName.name,
      foreignColumns: rootPkColumns,
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
      deferrable: false,
      initiallyDeferred: false,
    });
  }

  // Uniques — for joined children, only project uniques whose keys are all child-specific
  const uniques: Array<DesiredUniqueModel> = [];
  for (const unique of metadata.uniques) {
    if (child.isJoinedChild) {
      const allChildKeys = unique.keys.every(
        (k) => metadata.primaryKeys.includes(k) || !child.rootFieldKeys!.has(k),
      );
      if (!allChildKeys) continue;
    }

    const resolvedUniqueKeys = unique.keys.map((k) =>
      resolveColumnNameSafe(metadata.fields, k),
    );
    const name = unique.name ?? buildUniqueName(tableName, resolvedUniqueKeys);
    uniques.push({
      name,
      columns: resolvedUniqueKeys.map((colName) => {
        // ⚠ Historical mysql predicate replicated verbatim: the key is compared
        // against the RESOLVED column name (unlike indexes, which use the raw key).
        const field = metadata.fields.find(
          (f) => f.name === colName || f.key === colName,
        );
        return { name: colName, prefixLength: dialect.indexColumnPrefixLength(field) };
      }),
    });
  }

  // Checks — for joined children, include all checks (they may reference child columns)
  const checks: Array<DesiredCheckModel> = [];
  for (const check of metadata.checks) {
    const name = check.name ?? buildCheckName(tableName, check.expression);
    checks.push({ name, expression: check.expression });
  }

  // FK constraints from relations
  // For joined children, skip FK constraints whose join columns belong to root fields
  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    const foreignMeta = getForeignMetadata(relation, relation.foreignConstructor());
    const foreignName = getEntityName(foreignMeta, namespaceOptions);
    for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
      if (child.isJoinedChild && child.rootFieldKeys!.has(joinCol)) continue;

      const resolvedJoinCol = resolveColumnNameSafe(metadata.fields, joinCol);
      const resolvedForeignPk = resolveColumnNameSafe(foreignMeta.fields, foreignPk);
      const onDelete = dialect.mapOnDeleteAction(relation.options.onDestroy);
      const onUpdate = dialect.mapOnUpdateAction(relation.options.onUpdate);

      foreignKeys.push({
        kind: "relation",
        name: dialect.namedForeignKeys
          ? buildForeignKeyName(tableName, resolvedJoinCol)
          : null,
        columns: [resolvedJoinCol],
        foreignNamespace: foreignName.namespace,
        foreignTable: foreignName.name,
        foreignColumns: [resolvedForeignPk],
        onDelete,
        onUpdate,
        deferrable: relation.options.deferrable,
        initiallyDeferred: relation.options.initiallyDeferred,
      });
    }
  }

  return { primaryKey, foreignKeys, uniques, checks };
};
