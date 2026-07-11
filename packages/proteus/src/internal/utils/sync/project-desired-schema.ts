import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../types/types.js";
import type {
  DesiredEnumModel,
  DesiredSchemaModel,
  DesiredTableModel,
  DesiredTriggerModel,
} from "./desired-schema-model.js";
import type { SyncDialect } from "./sync-dialect.js";
import { addNamedEnum } from "./add-named-enum.js";
import { getEntityName } from "../../entity/utils/get-entity-name.js";
import { projectCollectionTables } from "./project-collection-table.js";
import { projectColumns } from "./project-columns.js";
import { projectConstraints } from "./project-constraints.js";
import { projectIndexes } from "./project-indexes.js";
import { projectJoinTables } from "./project-join-table.js";
import { resolveJoinedChildContext } from "./joined-child-context.js";

/**
 * Shared desired-schema projection core for the SQL drivers (postgres, mysql,
 * sqlite). Projects entity metadata into a dialect-neutral, value-resolved
 * `DesiredSchemaModel`: namespaces, extensions, named enum types (with
 * deduplication), tables, columns (including FK and embedded), primary/foreign
 * keys, uniques, checks, indexes, comments, triggers, ManyToMany join tables,
 * and EmbeddedList collection tables. All dialect decisions (types, spellings,
 * flags, errors) are resolved through the injected `SyncDialect`; each driver
 * then maps the model mechanically onto its own `Desired*` types.
 */
export const projectDesiredSchemaModel = (
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
  dialect: SyncDialect,
): DesiredSchemaModel => {
  const tables: Array<DesiredTableModel> = [];
  const enums: Array<DesiredEnumModel> = [];
  const enumSet = new Set<string>();
  const namespaceSet = new Set<string>();
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

    const child = resolveJoinedChildContext(metadata, namespaceOptions);
    const { effectiveFields } = child;

    const entityName = getEntityName(metadata, namespaceOptions);
    const { namespace, name: tableName } = entityName;

    if (dialect.supportsNamespaces && namespace) namespaceSet.add(namespace);

    // Validate column names against the dialect's identifier limit
    for (const field of effectiveFields) {
      if (field.name.length > dialect.identifierLimit) {
        throw dialect.identifierLimitError(field.name, metadata.target.name);
      }
    }

    // Extensions
    for (const extension of dialect.collectExtensions(
      effectiveFields,
      metadata.indexes,
    )) {
      extensionSet.add(extension);
    }

    // Named enum types (deduplicated by schema + name)
    for (const field of effectiveFields) {
      addNamedEnum(dialect.namedEnumType(field, tableName, namespace), enums, enumSet);
    }

    const columns = projectColumns({
      metadata,
      child,
      tableName,
      namespace,
      dialect,
      namespaceOptions,
    });

    const { primaryKey, foreignKeys, uniques, checks } = projectConstraints({
      metadata,
      child,
      tableName,
      dialect,
      namespaceOptions,
    });

    const indexes = projectIndexes({ metadata, child, tableName, dialect });

    // Comments — use effectiveFields for joined children
    const columnComments: Record<string, string> = {};
    for (const field of effectiveFields) {
      if (field.comment) {
        columnComments[field.name] = field.comment;
      }
    }

    // Triggers — append-only triggers when entity has @AppendOnly()
    const triggers: Array<DesiredTriggerModel> = metadata.appendOnly
      ? dialect.projectAppendOnlyTriggers(tableName, namespace)
      : [];

    tables.push({
      namespace,
      name: tableName,
      columns,
      primaryKey,
      foreignKeys,
      uniques,
      checks,
      indexes,
      comment: metadata.entity.comment ?? null,
      columnComments,
      triggers,
    });

    projectJoinTables({
      metadata,
      entityName,
      tables,
      namespaceSet,
      dialect,
      namespaceOptions,
    });

    projectCollectionTables({
      metadata,
      tableName,
      namespace,
      tables,
      enums,
      enumSet,
      namespaceSet,
      dialect,
    });
  }

  return {
    tables,
    enums,
    namespaces: Array.from(namespaceSet),
    extensions: Array.from(extensionSet),
  };
};
