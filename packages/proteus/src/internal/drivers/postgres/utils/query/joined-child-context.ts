import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier.js";
import type { FieldAliasOverrides } from "./compile-where.js";

/**
 * Context for building SQL statements that involve joined inheritance child tables.
 * Provides the USING/FROM clause, join conditions, and field alias overrides
 * needed to reference child-only columns in WHERE clauses.
 */
export type JoinedChildContext = {
  /** The child table qualified name + alias, e.g. `"ns"."dog" AS "t1"` */
  childTableRef: string;
  /** PK join conditions, e.g. `["t1"."id" = "t0"."id"]` */
  joinConditions: Array<string>;
  /** Maps child-only field keys to the child table alias */
  fieldAliasOverrides: FieldAliasOverrides;
  /** The child table alias (e.g. "t1") */
  childAlias: string;
  /** Set of child-only field column names */
  childFieldNames: Set<string>;
};

/**
 * Build context for joined inheritance child entities.
 *
 * Returns null for non-joined-child entities (root entities, single-table, no inheritance).
 *
 * @param metadata - the child entity metadata
 * @param namespace - schema namespace
 * @param rootAlias - alias for the root table (default "t0")
 * @param childAlias - alias for the child table (default "t1")
 */
export const buildJoinedChildContext = (
  metadata: EntityMetadata,
  namespace?: string | null,
  rootAlias = "t0",
  childAlias = "t1",
): JoinedChildContext | null => {
  const inh = metadata.inheritance;
  if (!inh) return null;
  if (inh.strategy !== "joined") return null;
  if (inh.discriminatorValue == null) return null; // root, not child

  const rootMeta = getEntityMetadata(inh.root);
  const rootFieldKeys = new Set(rootMeta.fields.map((f) => f.key));
  const pkKeys = new Set(metadata.primaryKeys);

  // Build child-only field sets
  const childFieldNames = new Set<string>();
  const fieldAliasOverrides: FieldAliasOverrides = new Map();

  for (const field of metadata.fields) {
    if (!rootFieldKeys.has(field.key) && !pkKeys.has(field.key)) {
      childFieldNames.add(field.name);
      fieldAliasOverrides.set(field.key, childAlias);
    }
  }

  // Build child table reference
  const childEntityName = getEntityName(metadata.target, {
    namespace: namespace ?? undefined,
  });
  const childTableRef = `${quoteQualifiedName(
    childEntityName.namespace ?? null,
    childEntityName.name,
  )} AS ${quoteIdentifier(childAlias)}`;

  // Build join conditions (PK equality)
  const joinConditions = rootMeta.primaryKeys.map((pk) => {
    const rootCol = rootMeta.fields.find((f) => f.key === pk)?.name ?? pk;
    const childCol = metadata.fields.find((f) => f.key === pk)?.name ?? pk;
    return `${quoteIdentifier(childAlias)}.${quoteIdentifier(childCol)} = ${quoteIdentifier(rootAlias)}.${quoteIdentifier(rootCol)}`;
  });

  return {
    childTableRef,
    joinConditions,
    fieldAliasOverrides,
    childAlias,
    childFieldNames,
  };
};
