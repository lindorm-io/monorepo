import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../types/query.js";
import type { MemoryIncludeMatch } from "./resolve-memory-includes.js";
import { defaultHydrateEntity } from "../../../entity/utils/default-hydrate-entity.js";
import { resolvePolymorphicMetadata } from "../../../entity/utils/resolve-polymorphic-metadata.js";

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
      hydrateRelationRow(foreignRow, match.foreignMetadata, match.include, amphora),
    );

    (entity as Dict)[match.include.relation] = match.isCollection
      ? related
      : (related[0] ?? null);
  }

  return entity;
};

const hydrateRelationRow = (
  row: Dict,
  foreignMetadata: EntityMetadata,
  include: IncludeSpec,
  amphora?: IAmphora,
): IEntity => {
  const effective = resolvePolymorphicMetadata(row, foreignMetadata);
  const metadata = include.select
    ? {
        ...effective,
        fields: effective.fields.filter((f) => include.select!.includes(f.key)),
      }
    : effective;

  return defaultHydrateEntity(structuredClone(row), metadata, {
    // A related entity is a read-only projection of the root query: it carries
    // no change-detection snapshot and fires no hooks, matching the SQL drivers.
    snapshot: false,
    hooks: false,
    amphora,
  });
};
