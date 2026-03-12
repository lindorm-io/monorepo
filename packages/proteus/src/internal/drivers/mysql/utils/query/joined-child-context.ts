import type { EntityMetadata } from "#internal/entity/types/metadata";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { getEntityName } from "#internal/entity/utils/get-entity-name";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import type { FieldAliasOverrides } from "./compile-where";

/**
 * Context for building SQL statements that involve joined inheritance child tables.
 */
export type JoinedChildContext = {
  /** The child table qualified name + alias, e.g. `\`dog\` AS \`t1\`` */
  childTableRef: string;
  /** The child table qualified name without alias, e.g. `\`schema\`.\`dog\`` or `\`dog\`` */
  childTableQualified: string;
  /** PK join conditions, e.g. [`\`t1\`.\`id\` = \`t0\`.\`id\``] */
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

  // Build child table reference -- MySQL uses namespace (database) as qualifier
  const childEntityName = getEntityName(metadata.target, {
    namespace: namespace ?? undefined,
  });
  const childTableQualified = quoteQualifiedName(namespace ?? null, childEntityName.name);
  const childTableRef = `${childTableQualified} AS ${quoteIdentifier(childAlias)}`;

  // Build join conditions (PK equality)
  const joinConditions = rootMeta.primaryKeys.map((pk) => {
    const rootCol = rootMeta.fields.find((f) => f.key === pk)?.name ?? pk;
    const childCol = metadata.fields.find((f) => f.key === pk)?.name ?? pk;
    return `${quoteIdentifier(childAlias)}.${quoteIdentifier(childCol)} = ${quoteIdentifier(rootAlias)}.${quoteIdentifier(rootCol)}`;
  });

  return {
    childTableRef,
    childTableQualified,
    joinConditions,
    fieldAliasOverrides,
    childAlias,
    childFieldNames,
  };
};
