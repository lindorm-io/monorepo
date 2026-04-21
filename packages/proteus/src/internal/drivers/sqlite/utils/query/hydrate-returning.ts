import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { defaultHydrateEntity } from "../../../../entity/utils/default-hydrate-entity.js";
import type { HydrateOptions } from "../../../../entity/utils/default-hydrate-entity.js";
import { extractFieldDictFromReturning } from "./extract-field-dict.js";

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
