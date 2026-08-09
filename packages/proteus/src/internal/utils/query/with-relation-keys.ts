import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { IncludeSpec } from "../../types/query.js";

/**
 * Add the primary key to a projection that asks for relations.
 *
 * A projection naming columns but not the row's identity cannot be related to
 * anything. The join strategy fans a root row out across its relations and folds
 * the rows back into entities by the root primary key; the query strategy reads
 * that key off the hydrated root to ask the relation table for its rows. Withheld,
 * every root grouped under the same empty key and the whole result collapsed into
 * ONE entity carrying everyone's relations — or the relation query had no key to
 * ask for and came back empty. Neither is distinguishable from a real result.
 *
 * It is added to the SELECTION rather than smuggled in by the compiler, so the
 * state says what it is going to read and every driver sees the same thing.
 *
 * A projection with no relations is left exactly as the caller wrote it — a
 * GROUP BY projection must name what it groups by and nothing else.
 */
export const withRelationKeys = <E extends IEntity>(
  selections: Array<keyof E> | null,
  includes: Array<IncludeSpec>,
  metadata: EntityMetadata,
): Array<keyof E> | null =>
  selections && includes.length > 0
    ? ([...new Set([...(selections as Array<string>), ...metadata.primaryKeys])] as Array<
        keyof E
      >)
    : selections;
