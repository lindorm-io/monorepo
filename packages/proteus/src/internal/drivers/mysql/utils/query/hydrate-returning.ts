import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { defaultHydrateEntity } from "#internal/entity/utils/default-hydrate-entity";
import type { HydrateOptions } from "#internal/entity/utils/default-hydrate-entity";
import { extractFieldDictFromReturning } from "./extract-field-dict";

/**
 * Hydrate an entity from a SELECT-back result row.
 *
 * MySQL has no RETURNING clause, so this hydrates from a SELECT * result
 * that follows a write operation. The row format matches RETURNING format
 * (column names, not aliased).
 */
export const hydrateReturning = <E extends IEntity>(
  row: Record<string, unknown>,
  metadata: EntityMetadata,
  options?: HydrateOptions,
): E => {
  const dict = extractFieldDictFromReturning(row, metadata);
  return defaultHydrateEntity<E>(dict, metadata, options);
};

export const hydrateReturningRows = <E extends IEntity>(
  rows: Array<Record<string, unknown>>,
  metadata: EntityMetadata,
  options?: HydrateOptions,
): Array<E> => {
  return rows.map((row) => hydrateReturning<E>(row, metadata, options));
};
