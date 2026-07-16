import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { quoteQualifiedName } from "../quote-identifier.js";

/**
 * Quote the child table name of a joined inheritance entity, resolving the
 * entity-level namespace via getEntityName (a joined child that declares its own
 * `@Entity({ namespace })` must qualify against THAT database, not the raw
 * session namespace — otherwise its columns are written to the wrong database).
 */
export const quoteChildTableName = (
  metadata: EntityMetadata,
  namespace?: string | null,
): string => {
  const childEntityName = getEntityName(metadata, {
    namespace: namespace ?? undefined,
  });
  return quoteQualifiedName(childEntityName.namespace ?? null, childEntityName.name);
};
