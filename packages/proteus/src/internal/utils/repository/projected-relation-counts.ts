import type { EntityMetadata, MetaRelationCount } from "../../entity/types/metadata.js";

/**
 * The `@RelationCount` properties a projection asks for.
 *
 * Named means populated, omitted means skipped — the same bargain a
 * `@RelationId` strikes, and for the same reason: every relation count costs a
 * query. A SQL driver runs one batched `COUNT(*) … GROUP BY` per count on every
 * read, and a document driver counts the foreign rows once PER ENTITY, so an
 * unnamed one is a round trip nobody asked for.
 *
 * No projection means the caller asked for the whole entity, so every relation
 * count loads.
 */
export const projectedRelationCounts = (
  metadata: EntityMetadata,
  select: Array<string> | null,
): Array<MetaRelationCount> =>
  select
    ? (metadata.relationCounts ?? []).filter((relationCount) =>
        select.includes(relationCount.key),
      )
    : (metadata.relationCounts ?? []);
