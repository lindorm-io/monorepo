import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { quoteQualifiedName } from "../quote-identifier.js";

/**
 * Quote the child table name of a joined inheritance entity.
 * MySQL uses the raw session namespace (database) as qualifier.
 */
export const quoteChildTableName = (
  metadata: EntityMetadata,
  namespace?: string | null,
): string => {
  const childEntityName = getEntityName(metadata, {
    namespace: namespace ?? undefined,
  });
  return quoteQualifiedName(namespace ?? null, childEntityName.name);
};
