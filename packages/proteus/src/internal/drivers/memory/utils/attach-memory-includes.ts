import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata, MetaRelation } from "../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../types/query.js";
import type { MemoryIncludeMatch } from "./resolve-memory-includes.js";
import { defaultHydrateEntity } from "../../../entity/utils/default-hydrate-entity.js";
import { resolvePolymorphicMetadata } from "../../../entity/utils/resolve-polymorphic-metadata.js";
import {
  clearImplicitKeys,
  includeProjection,
  restrictToProjection,
} from "../../../utils/query/include-projection.js";

/**
 * Assign the resolved relations onto a hydrated root entity.
 *
 * An unmatched relation is an EMPTY relation, never an absent property: `[]`
 * for OneToMany / ManyToMany and `null` for ManyToOne / OneToOne — the same
 * shape the SQL drivers produce for a LEFT JOIN that found nothing. Rows
 * excluded by `required` never reach here; they are dropped before hydration.
 */
export const attachMemoryIncludes = <E extends IEntity>(
  entity: E,
  row: Dict,
  matches: Array<MemoryIncludeMatch>,
  amphora?: IAmphora,
): E => {
  for (const match of matches) {
    const related = (match.rows.get(row) ?? []).map((foreignRow) =>
      hydrateRelationRow(
        foreignRow,
        match.relation,
        match.foreignMetadata,
        match.include,
        amphora,
      ),
    );

    (entity as Dict)[match.include.relation] = match.isCollection
      ? related
      : (related[0] ?? null);
  }

  return entity;
};

const hydrateRelationRow = (
  row: Dict,
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
  include: IncludeSpec,
  amphora?: IAmphora,
): IEntity => {
  const effective = resolvePolymorphicMetadata(row, foreignMetadata);

  // Memory matches a relation on the stored rows before it projects anything, so
  // `select` costs it no stitching key and it passes none. Hydration still
  // attaches an owning foreign key of its own accord, though, and a caller that
  // named its columns did not ask for that one.
  const projection = includeProjection(include, relation, effective, () => []);

  const entity = defaultHydrateEntity(
    structuredClone(row),
    restrictToProjection(effective, projection),
    {
      // A related entity is a read-only projection of the root query: it carries
      // no change-detection snapshot and fires no hooks, matching the SQL drivers.
      snapshot: false,
      hooks: false,
      amphora,
    },
  );

  clearImplicitKeys(entity, projection);

  return entity;
};
