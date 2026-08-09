import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { Document } from "mongodb";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import {
  findRelationByKey,
  getRelationMetadata,
} from "../../../../utils/query/get-relation-metadata.js";
import {
  includeProjection,
  joinStitchKeys,
} from "../../../../utils/query/include-projection.js";
import { relationAlias } from "./compile-include-lookup.js";
import { hydrateRelationDocument } from "./hydrate-relation-document.js";

/**
 * Move the relations a `$lookup` nested on the document onto the hydrated root.
 *
 * A `$lookup` always yields an array, so the to-one shape is decided here: `[]`
 * for a to-many and `null` for a to-one, never an absent property — the same
 * shape a LEFT JOIN that found nothing produces on the SQL drivers. Roots
 * excluded by `required` never reach this point; the pipeline dropped them.
 */
export const attachLookupIncludes = <E extends IEntity>(
  entity: E,
  doc: Document,
  includes: Array<IncludeSpec>,
  rootMetadata: EntityMetadata,
  amphora?: IAmphora,
): E => {
  for (const include of includes) {
    const relation = findRelationByKey(rootMetadata, include.relation);
    const foreignMetadata = getRelationMetadata(relation);
    const projection = includeProjection(
      include,
      relation,
      foreignMetadata,
      joinStitchKeys,
    );

    const docs = (doc[relationAlias(include.relation)] ?? []) as Array<Document>;
    const related = docs.map((related) =>
      hydrateRelationDocument(related, foreignMetadata, projection, amphora),
    );

    const isCollection = relation.type === "OneToMany" || relation.type === "ManyToMany";
    (entity as Dict)[include.relation] = isCollection ? related : (related[0] ?? null);
  }

  return entity;
};

/** The lookup output is the driver's scratch space, never part of the root. */
export const stripLookupAliases = (
  doc: Document,
  includes: Array<IncludeSpec>,
): Document => {
  const stripped = { ...doc };
  for (const include of includes) delete stripped[relationAlias(include.relation)];
  return stripped;
};
