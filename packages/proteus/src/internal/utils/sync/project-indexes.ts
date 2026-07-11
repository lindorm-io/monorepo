import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { DesiredIndexModel } from "./desired-schema-model.js";
import type { JoinedChildContext } from "./joined-child-context.js";
import type { SyncDialect } from "./sync-dialect.js";
import { buildIndexName } from "../sql/constraint-names.js";
import { resolveColumnNameSafe } from "../sql/resolve-column-name.js";

export type ProjectIndexesOptions = {
  metadata: EntityMetadata;
  child: JoinedChildContext;
  tableName: string;
  dialect: SyncDialect;
};

/**
 * Projects an entity table's indexes: declared @Index entries (child-only keys
 * for joined children; sparse indexes become quoted IS NOT NULL WHERE clauses)
 * plus the auto-index on the discriminator column for inheritance roots (both
 * single-table and joined) — unless a user index already covers that column.
 */
export const projectIndexes = (
  options: ProjectIndexesOptions,
): Array<DesiredIndexModel> => {
  const { metadata, child, tableName, dialect } = options;
  const indexes: Array<DesiredIndexModel> = [];

  for (const index of metadata.indexes) {
    const validKeys = index.keys.filter(
      (k) => k.direction === "asc" || k.direction === "desc",
    );
    if (validKeys.length === 0) continue;

    // For joined children, skip indexes that reference root-only fields
    if (child.isJoinedChild) {
      const allChildKeys = validKeys.every(
        (k) => metadata.primaryKeys.includes(k.key) || !child.rootFieldKeys!.has(k.key),
      );
      if (!allChildKeys) continue;
    }

    const resolvedIndexKeys = validKeys.map((k) =>
      resolveColumnNameSafe(metadata.fields, k.key),
    );
    const autoName = buildIndexName(tableName, resolvedIndexKeys);
    const name = index.name ?? autoName;
    const method = index.using?.toLowerCase() ?? "btree";

    let where: string | null = null;
    if (index.where) {
      where = index.where;
    } else if (index.sparse) {
      where = resolvedIndexKeys
        .map((k) => `${dialect.quoteIdentifier(k)} IS NOT NULL`)
        .join(" AND ");
    }

    indexes.push({
      name,
      unique: index.unique,
      columns: validKeys.map((k) => {
        const colName = resolveColumnNameSafe(metadata.fields, k.key);
        // ⚠ Historical mysql predicate replicated verbatim: the key is compared
        // against the RAW index key (unlike uniques, which use the resolved name).
        const field = metadata.fields.find((f) => f.name === colName || f.key === k.key);
        return {
          name: colName,
          direction: k.direction,
          opclass: k.opclass ?? null,
          prefixLength: dialect.indexColumnPrefixLength(field),
        };
      }),
      method,
      where,
      include:
        index.include?.map((k) => resolveColumnNameSafe(metadata.fields, k)) ?? null,
      concurrent: index.concurrent,
      origin: "user",
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
    const discrimField = metadata.fields.find(
      (f) => f.name === discrimCol || f.key === metadata.inheritance!.discriminatorField,
    );
    const discrimIdxName = buildIndexName(tableName, [discrimCol]);

    // Only add if no user-defined index already covers this column
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
            opclass: null,
            prefixLength: dialect.indexColumnPrefixLength(discrimField),
          },
        ],
        method: "btree",
        where: null,
        include: null,
        concurrent: false,
        origin: "auto",
      });
    }
  }

  return indexes;
};
