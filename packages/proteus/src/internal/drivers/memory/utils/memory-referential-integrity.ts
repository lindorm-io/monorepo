import type { Constructor, Dict } from "@lindorm/types";
import { ForeignKeyViolationError } from "../../../../errors/ForeignKeyViolationError.js";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata, MetaRelation } from "../../../entity/types/metadata.js";
import { getForeignMetadata } from "../../../entity/metadata/foreign-metadata.js";
import { getRegisteredTargets } from "../../../entity/metadata/registry.js";
import { getEntityName } from "../../../entity/utils/get-entity-name.js";
import { REDACTED, redactSensitive } from "../../../entity/utils/redact-sensitive.js";
import { resolveInheritanceRoot } from "../../../entity/utils/resolve-inheritance-root.js";
import type { MemoryStore, MemoryTable } from "../types/memory-store.js";

/**
 * Resolve the memory store table key for an entity target, root-resolved for
 * inheritance and namespace-aware. Mirrors the resolution used by MemoryDriver.
 */
export const resolveTableKey = (
  metadata: EntityMetadata,
  namespace: string | null,
): string => {
  const rootTarget = resolveInheritanceRoot(metadata.target, metadata);
  // Resolve the root's metadata through the same source resolver (naming-aware)
  // so an inheritance child keys off the ROOT's strategy-applied table name.
  const rootMeta =
    rootTarget === metadata.target ? metadata : getForeignMetadata(metadata, rootTarget);
  const entityName = getEntityName(rootMeta, { namespace });
  return entityName.namespace
    ? `${entityName.namespace}.${entityName.name}`
    : entityName.name;
};

/** Owning-side, non-ManyToMany relations carry real FK constraints. */
const owningRelations = (metadata: EntityMetadata): Array<MetaRelation> =>
  metadata.relations.filter(
    (relation) => relation.joinKeys != null && relation.type !== "ManyToMany",
  );

const tableContainsForeignValue = (
  table: MemoryTable,
  foreignPk: string,
  value: unknown,
): boolean => {
  for (const parentRow of table.values()) {
    if (parentRow[foreignPk] === value) return true;
  }
  return false;
};

/**
 * Validate that every non-null FK column on a row points to an existing parent
 * row. Called before insert/update writes. Mirrors Postgres SQLSTATE 23503.
 */
export const assertForeignKeysExist = (
  row: Dict,
  metadata: EntityMetadata,
  store: MemoryStore,
  namespace: string | null,
): void => {
  for (const relation of owningRelations(metadata)) {
    const foreignMeta = getForeignMetadata(relation, relation.foreignConstructor());
    const tableKey = resolveTableKey(foreignMeta, namespace);
    const parentTable = store.tables.get(tableKey);

    for (const [localCol, foreignPk] of Object.entries(relation.joinKeys!)) {
      const value = row[localCol];
      if (value == null) continue;

      const exists =
        parentTable != null && tableContainsForeignValue(parentTable, foreignPk, value);

      if (!exists) {
        // The FK column holds the PARENT's PK value — redact when either the
        // child FK field or the referenced parent PK field is @Sensitive
        const sensitive =
          metadata.fields.find((f) => f.key === localCol)?.sensitive != null ||
          foreignMeta.fields.find((f) => f.key === foreignPk)?.sensitive != null;
        const safeValue = sensitive ? REDACTED : value;
        throw new ForeignKeyViolationError(
          `Foreign key violation: "${metadata.entity.name}.${localCol}" references a non-existent "${foreignMeta.entity.name}" row`,
          {
            code: "foreign_key_violation",
            title: "Foreign Key Violation",
            details: `The value "${String(safeValue)}" supplied for "${localCol}" does not match any existing parent row; the foreign key constraint was violated.`,
            data: {
              entityName: metadata.entity.name,
              column: localCol,
              foreignColumn: foreignPk,
            },
            debug: { value: safeValue, table: tableKey },
          },
        );
      }
    }
  }
};

/**
 * Apply ON DELETE referential actions to children of the rows being deleted.
 * Must run BEFORE the parent rows are removed, and may throw (restrict / no
 * action), in which case the caller must abort the whole delete.
 */
export const applyDeleteReferentialActions = (
  deletedRows: Array<Dict>,
  parentMetadata: EntityMetadata,
  store: MemoryStore,
  namespace: string | null,
): void => {
  if (deletedRows.length === 0) return;

  const parentTarget = parentMetadata.target;

  for (const childTarget of getRegisteredTargets()) {
    const childMetadata = getForeignMetadata(
      parentMetadata,
      childTarget as Constructor<IEntity>,
    );

    for (const relation of owningRelations(childMetadata)) {
      if (relation.foreignConstructor() !== parentTarget) continue;

      const childTableKey = resolveTableKey(childMetadata, namespace);
      const childTable = store.tables.get(childTableKey);
      if (!childTable) continue;

      for (const [localCol, foreignPk] of Object.entries(relation.joinKeys!)) {
        for (const parentRow of deletedRows) {
          const pkValue = parentRow[foreignPk];
          if (pkValue == null) continue;

          const matches: Array<[string, Dict]> = [];
          for (const [key, childRow] of childTable) {
            if (childRow[localCol] === pkValue) {
              matches.push([key, childRow]);
            }
          }
          if (matches.length === 0) continue;

          switch (relation.options.onDestroy) {
            case "cascade": {
              const cascaded = matches.map(([, childRow]) => childRow);
              for (const [key] of matches) {
                childTable.delete(key);
              }
              applyDeleteReferentialActions(cascaded, childMetadata, store, namespace);
              break;
            }

            case "set_null": {
              for (const [, childRow] of matches) {
                childRow[localCol] = null;
              }
              break;
            }

            case "set_default":
              // No default tracking in the memory store — treat as no-op.
              break;

            case "restrict":
            case "ignore":
            default:
              throw new ForeignKeyViolationError(
                `Foreign key violation: cannot delete "${parentMetadata.entity.name}" because dependent "${childMetadata.entity.name}" rows exist`,
                {
                  code: "foreign_key_violation",
                  title: "Foreign Key Violation",
                  details: `The delete was rejected because ${matches.length} dependent "${childMetadata.entity.name}" row(s) still reference "${parentMetadata.entity.name}.${foreignPk}" via "${localCol}".`,
                  data: {
                    entityName: parentMetadata.entity.name,
                    childEntityName: childMetadata.entity.name,
                    column: localCol,
                    foreignColumn: foreignPk,
                    onDestroy: relation.options.onDestroy,
                  },
                  debug: {
                    // A @Sensitive parent PK column must not leak into error output
                    value: redactSensitive(
                      parentMetadata.fields.find((f) => f.key === foreignPk),
                      pkValue,
                    ),
                    childTable: childTableKey,
                  },
                },
              );
          }
        }
      }
    }
  }
};
