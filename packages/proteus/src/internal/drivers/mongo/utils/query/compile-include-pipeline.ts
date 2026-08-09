import type { Document, Filter } from "mongodb";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import { compileIncludeLookup, relationAlias } from "./compile-include-lookup.js";

export type IncludePipelineOptions = {
  filter: Filter<Document>;
  includes: Array<IncludeSpec>;
  rootMetadata: EntityMetadata;
  withDeleted: boolean;
  versionTimestamp: Date | null;
  sort?: Document;
  skip?: number | null;
  take?: number | null;
  projection?: Document;
  /**
   * Build only what decides whether a root survives — for `count()` and
   * `exists()`, where an optional relation cannot change the answer.
   */
  minimal?: boolean;
};

/**
 * The aggregation a JOIN-strategy read runs: match the roots, attach every
 * relation, then order and paginate.
 *
 * Relations are resolved BEFORE ordering and pagination, so a required one
 * governs which roots exist at all — the way an inner join does — rather than
 * quietly shrinking a page that was already cut.
 *
 * The root projection is the LAST stage, not the first: a to-one relation is
 * looked up through the root's own foreign key, and a projection naming only the
 * caller's columns would have removed it before the lookup could read it. Going
 * last also means the relation aliases have to be re-admitted, which is why they
 * are added back to the projection.
 */
export const compileIncludePipeline = (
  options: IncludePipelineOptions,
): Array<Document> => {
  const ctx = {
    rootMetadata: options.rootMetadata,
    withDeleted: options.withDeleted,
    versionTimestamp: options.versionTimestamp,
  };

  const pipeline: Array<Document> = [];

  if (Object.keys(options.filter).length > 0) {
    pipeline.push({ $match: options.filter });
  }

  const includes = options.minimal
    ? options.includes.filter((include) => include.required)
    : options.includes;

  for (const include of includes) {
    pipeline.push(...compileIncludeLookup(include, ctx, options.minimal));
  }

  if (options.minimal) return pipeline;

  if (options.sort) pipeline.push({ $sort: options.sort });
  if (options.skip != null && options.skip > 0) pipeline.push({ $skip: options.skip });
  if (options.take != null) pipeline.push({ $limit: options.take });

  if (options.projection) {
    pipeline.push({
      $project: {
        ...options.projection,
        ...Object.fromEntries(
          options.includes.map((include) => [relationAlias(include.relation), 1]),
        ),
      },
    });
  }

  return pipeline;
};
