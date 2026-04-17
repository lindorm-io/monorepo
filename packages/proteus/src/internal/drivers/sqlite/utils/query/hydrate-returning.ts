import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { defaultHydrateEntity } from "../../../../entity/utils/default-hydrate-entity";
import type { HydrateOptions } from "../../../../entity/utils/default-hydrate-entity";
import { extractFieldDictFromReturning } from "./extract-field-dict";

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
