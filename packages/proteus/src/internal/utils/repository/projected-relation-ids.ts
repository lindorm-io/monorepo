import type { EntityMetadata, MetaRelationId } from "../../entity/types/metadata.js";

/**
 * The `@RelationId` properties a projection asks for.
 *
 * Named means populated, omitted means skipped — and skipping is what this is
 * for: an owning `*ToOne` relationId rides along on the FK column that was
 * fetched anyway, but a `OneToMany`, a `ManyToMany` and an inverse `OneToOne`
 * each cost their own query, so an unnamed one is a round trip for a value
 * nobody asked for.
 *
 * No projection means the caller asked for the whole entity, so every
 * relationId loads.
 */
export const projectedRelationIds = (
  metadata: EntityMetadata,
  select: Array<string> | null,
): Array<MetaRelationId> =>
  select
    ? (metadata.relationIds ?? []).filter((relationId) => select.includes(relationId.key))
    : (metadata.relationIds ?? []);
