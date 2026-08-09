import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata, MetaRelation } from "../../entity/types/metadata.js";
import type { IncludeSpec } from "../../types/query.js";
import { resolvePropertyKey } from "../../entity/utils/resolve-property-key.js";

/**
 * What a per-relation `select` resolves to once the driver has added the keys it
 * cannot work without.
 *
 * `select` names the columns the CALLER wants on the related entity, and decides
 * nothing else. Matching a relation up with its root needs other keys entirely —
 * a foreign primary key, the foreign key pointing back at the root — and which
 * ones is the driver's business, not something a caller asking for a title
 * should have to know. Leaving them out of the projection did not narrow the
 * entity, it made the relation come back EMPTY: `hasData` and the stitching maps
 * read a column that was never selected, found nothing, and reported a matched
 * relation as no match at all.
 *
 * So the keys are always projected (`keys`) and cleared off the hydrated entity
 * again (`implicit`). A key the caller named is never implicit — asking for a
 * primary key gets you the primary key.
 */
export type IncludeProjection = {
  /** Field keys to project: the caller's `select` plus the keys the driver needs. */
  keys: Array<string>;
  /** Property keys added on the caller's behalf, cleared once stitching is done. */
  implicit: Array<string>;
};

const unique = (keys: Array<string>): Array<string> => [...new Set(keys)];

/**
 * The discriminator routes a polymorphic relation target to its child
 * constructor, so hydrating one without it silently builds the parent class.
 */
const discriminatorKeys = (metadata: EntityMetadata): Array<string> =>
  metadata.inheritance ? [metadata.inheritance.discriminatorField] : [];

/**
 * The foreign keys hydration projects onto an entity of its own accord (owning
 * side, non-ManyToMany). They are not `fields`, so restricting the metadata does
 * not hold them back — they have to be cleared explicitly.
 */
const projectedForeignKeys = (metadata: EntityMetadata): Array<string> =>
  metadata.relations
    .filter((relation) => relation.joinKeys && relation.type !== "ManyToMany")
    .flatMap((relation) =>
      Object.keys(relation.joinKeys!).map((column) =>
        resolvePropertyKey(metadata.fields, column),
      ),
    );

/**
 * What the JOIN strategy reads off a joined row: the foreign primary key decides
 * whether the row matched at all and dedupes the repeats a to-many join
 * produces, and an `@OrderBy` on the relation sorts the hydrated entities by
 * their own property.
 */
export const joinStitchKeys = (
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
): Array<string> => [
  ...foreignMetadata.primaryKeys,
  ...discriminatorKeys(foreignMetadata),
  ...(relation.orderBy ? Object.keys(relation.orderBy) : []),
];

/**
 * What the QUERY strategy reads off a separately-queried row: the key the
 * relation is declared through — the foreign primary key on an owning side, the
 * foreign key pointing back at the root on an inverse one. A many-to-many is
 * matched through join-table columns that the relation query selects under
 * aliases of its own, so the foreign table owes it nothing. Ordering is done by
 * the database here, which needs no column in the projection.
 */
export const queryStitchKeys = (
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
): Array<string> => [
  ...(relation.type === "ManyToMany" && isString(relation.joinTable)
    ? []
    : relation.joinKeys
      ? Object.values(relation.joinKeys)
      : Object.keys(relation.findKeys ?? {}).map((column) =>
          resolvePropertyKey(foreignMetadata.fields, column),
        )),
  ...discriminatorKeys(foreignMetadata),
];

/**
 * Resolve a relation's `select` against the keys the driver needs, given the
 * stitch-key resolver for the strategy in play. `null` means the caller named no
 * columns, so the whole entity is projected as it stands — and the resolver is
 * never consulted.
 *
 * A driver that matches relations on its stored rows rather than on the
 * projection resolves no stitch keys at all — it still needs the projected
 * foreign keys cleared, since hydration attaches those unasked.
 */
export const includeProjection = (
  include: IncludeSpec,
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
  stitchKeys: (relation: MetaRelation, foreignMetadata: EntityMetadata) => Array<string>,
): IncludeProjection | null => {
  if (!include.select) return null;

  const select = include.select;
  const stitch = stitchKeys(relation, foreignMetadata);
  const added = [...stitch, ...projectedForeignKeys(foreignMetadata)];

  return {
    keys: unique([...select, ...stitch]),
    implicit: unique(added.filter((key) => !select.includes(key))),
  };
};

/** Restrict metadata to the projected fields, so hydration assigns those alone. */
export const restrictToProjection = (
  metadata: EntityMetadata,
  projection: IncludeProjection | null,
): EntityMetadata =>
  projection
    ? {
        ...metadata,
        fields: metadata.fields.filter((f) => projection.keys.includes(f.key)),
      }
    : metadata;

/** Clear the keys the caller never asked for off a stitched relation entity. */
export const clearImplicitKeys = (
  entity: unknown,
  projection: IncludeProjection | null,
): void => {
  if (!projection) return;
  for (const key of projection.implicit) delete (entity as Dict)[key];
};
