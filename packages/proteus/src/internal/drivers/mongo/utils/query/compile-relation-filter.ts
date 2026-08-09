import type { Document, Filter } from "mongodb";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import { flattenEmbeddedCriteria } from "../../../../utils/query/flatten-embedded-criteria.js";
import { compileFilterWithSystem } from "../compile-filter.js";

export type RelationFilterContext = {
  withDeleted: boolean;
  versionTimestamp: Date | null;
};

/**
 * Everything the FOREIGN side of a relation is filtered by: the foreign entity's
 * own system filters and discriminator, the temporal-version window, and the
 * per-relation `where`.
 *
 * The `where` belongs to the relation and never to the root — a relation
 * filtered to nothing lands in exactly the same place as a relation with no
 * match at all, which is what makes `required` the only thing that can drop a
 * root. Returns `null` when nothing constrains the foreign side.
 */
export const compileRelationFilter = (
  include: IncludeSpec,
  foreignMetadata: EntityMetadata,
  ctx: RelationFilterContext,
): Filter<Document> | null => {
  const conditions: Array<Filter<Document>> = [];

  const base = compileFilterWithSystem(
    include.where ? flattenEmbeddedCriteria(include.where, foreignMetadata) : {},
    foreignMetadata,
    new Map(),
    { withDeleted: ctx.withDeleted },
  );
  if (Object.keys(base).length > 0) conditions.push(base);

  const startField = foreignMetadata.fields.find(
    (f) => f.decorator === "VersionStartDate",
  );
  const endField = foreignMetadata.fields.find((f) => f.decorator === "VersionEndDate");

  if (startField && endField) {
    conditions.push(
      ctx.versionTimestamp
        ? {
            [startField.name]: { $lte: ctx.versionTimestamp },
            $or: [
              { [endField.name]: null },
              { [endField.name]: { $gt: ctx.versionTimestamp } },
            ],
          }
        : { [endField.name]: null },
    );
  }

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};
