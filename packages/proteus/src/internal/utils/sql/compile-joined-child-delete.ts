import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { PredicateEntry } from "#internal/types/query";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { getEntityName } from "#internal/entity/utils/get-entity-name";
import type { CompiledSql } from "./compiled-sql";
import { compileWhere } from "./compile-where";
import type { SqlDialect } from "./sql-dialect";

/**
 * Compiles a DELETE statement for the child table of a joined inheritance entity.
 * Returns null if the entity is not a joined inheritance child.
 *
 * This ensures child table rows are explicitly removed before the parent (root)
 * table DELETE, avoiding orphan rows when FK CASCADE constraints are missing
 * (e.g. `synchronize: false` in production with manual migrations).
 */
export const compileJoinedChildDelete = <E extends IEntity>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  dialect: SqlDialect,
  namespace?: string | null,
): CompiledSql | null => {
  const inh = metadata.inheritance;
  if (!inh) return null;
  if (inh.strategy !== "joined") return null;
  if (inh.discriminatorValue == null) return null; // root entity, not a child

  // Only emit the child DELETE when all criteria fields exist on BOTH tables.
  // If criteria reference root-only fields, the child DELETE would fail.
  // If criteria reference child-only fields, the subsequent parent DELETE
  // (with skipJoinedContext) would fail because those columns don't exist
  // on the root table. In either case, fall back to the standard JOIN-based
  // DELETE which handles both tables correctly.
  const rootMeta = getEntityMetadata(inh.root);
  const rootFieldKeys = new Set(rootMeta.fields.map((f) => f.key));
  const rootOnlyKeys = new Set(
    rootMeta.fields
      .filter((f) => !metadata.primaryKeys.includes(f.key))
      .map((f) => f.key),
  );
  const criteriaKeys = Object.keys(criteria).filter((k) => !k.startsWith("$"));
  if (criteriaKeys.some((k) => rootOnlyKeys.has(k))) return null;
  // Child-only fields: exist on child metadata but not on root
  if (criteriaKeys.some((k) => !rootFieldKeys.has(k))) return null;

  const childEntityName = getEntityName(metadata.target, {
    namespace: namespace ?? undefined,
  });
  const childSchema = dialect.supportsNamespace
    ? (childEntityName.namespace ?? null)
    : null;
  const childTableName = dialect.quoteQualifiedName(childSchema, childEntityName.name);

  const params: Array<unknown> = [];
  const entries: Array<PredicateEntry<E>> = [{ predicate: criteria, conjunction: "and" }];
  const alias = dialect.supportsDeleteAlias ? "t0" : null;
  const whereClause = compileWhere(entries, metadata, alias, params, dialect);

  const aliasSuffix = alias ? ` AS ${dialect.quoteIdentifier(alias)}` : "";
  const text = `DELETE FROM ${childTableName}${aliasSuffix} ${whereClause}`;
  return { text, params };
};
