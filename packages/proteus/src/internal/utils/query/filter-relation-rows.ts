import { Matcher } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata } from "../../entity/types/metadata.js";
import type { IncludeSpec } from "../../types/query.js";
import { generateAutoFilters } from "../../entity/metadata/auto-filters.js";
import { flattenEmbeddedCriteria } from "./flatten-embedded-criteria.js";
import { mergeSystemFilterOverrides } from "./merge-system-filter-overrides.js";
import { resolveFilters } from "./resolve-filters.js";

export type RelationRowFilterOptions = {
  withDeleted: boolean;
  versionTimestamp: Date | null;
};

/**
 * Narrow the rows a relation may be drawn from, for a driver that filters in
 * process rather than in the store.
 *
 * Four things decide membership, and they are exactly the four a SQL driver
 * puts on the joined table: the inheritance discriminator, the temporal-version
 * window, the foreign entity's own system filters (soft delete, scope), and the
 * per-relation `where`. Applying them here — before anything is matched to a
 * root — is what makes a relation filtered to nothing land in the same place as
 * a relation with no rows at all.
 */
export const filterRelationRows = (
  rows: Array<Dict>,
  foreignMetadata: EntityMetadata,
  include: IncludeSpec,
  options: RelationRowFilterOptions,
): Array<Dict> => {
  let result = rows;

  // An inheritance child shares its root's storage, so the discriminator is
  // what separates it from its siblings.
  const inheritance = foreignMetadata.inheritance;
  if (inheritance && inheritance.discriminatorValue != null) {
    result = result.filter(
      (row) => row[inheritance.discriminatorField] === inheritance.discriminatorValue,
    );
  }

  const startField = foreignMetadata.fields.find(
    (f) => f.decorator === "VersionStartDate",
  );
  const endField = foreignMetadata.fields.find((f) => f.decorator === "VersionEndDate");
  if (startField && endField) {
    result = options.versionTimestamp
      ? result.filter((row) =>
          inVersionWindow(row, startField.key, endField.key, options.versionTimestamp!),
        )
      : result.filter((row) => row[endField.key] == null);
  }

  const metaFilters = foreignMetadata.filters?.length
    ? foreignMetadata.filters
    : generateAutoFilters(foreignMetadata.fields);
  const overrides = mergeSystemFilterOverrides(undefined, options.withDeleted);
  for (const filter of resolveFilters(metaFilters, new Map(), overrides)) {
    result = Matcher.filter(result, filter.predicate);
  }

  if (include.where) {
    result = Matcher.filter(
      result,
      flattenEmbeddedCriteria(include.where, foreignMetadata) as never,
    );
  }

  return result;
};

const inVersionWindow = (
  row: Dict,
  startKey: string,
  endKey: string,
  timestamp: Date,
): boolean => {
  const ts = timestamp.getTime();
  const start = row[startKey];
  const end = row[endKey];
  const startTime = start == null ? 0 : new Date(start as string).getTime();
  const endTime = end == null ? Infinity : new Date(end as string).getTime();
  return startTime <= ts && ts < endTime;
};
