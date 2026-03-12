import type { Dict } from "@lindorm/types";
import {
  SCOPE_FILTER_NAME,
  SOFT_DELETE_FILTER_NAME,
} from "#internal/entity/metadata/auto-filters";

/**
 * Merge system-level boolean flags (e.g. `withDeleted`, `withoutScope`) into the
 * per-request filter overrides dict before passing to `resolveFilters`.
 *
 * This bridges the user-facing `FindOptions.withDeleted: true` and
 * `FindOptions.withoutScope: true` APIs to the internal `__softDelete` and
 * `__scope` system filters, keeping filter resolution generic.
 *
 * System flag mappings take precedence over manual filter overrides for the
 * corresponding system filters. For example, if someone manually sets
 * `filters: { __softDelete: true }` alongside `withDeleted: true`, the
 * `withDeleted` mapping wins because system flags are applied after spreading
 * `requestOverrides`, overwriting any manual entry for the same key.
 */
export const mergeSystemFilterOverrides = (
  requestOverrides: Record<string, boolean | Dict<unknown>> | undefined,
  withDeleted: boolean,
  withoutScope?: boolean,
): Record<string, boolean | Dict<unknown>> | undefined => {
  if (!withDeleted && !withoutScope) return requestOverrides;

  const merged: Record<string, boolean | Dict<unknown>> = {
    ...requestOverrides,
  };

  // withDeleted: true -> disable __softDelete filter
  if (withDeleted) {
    merged[SOFT_DELETE_FILTER_NAME] = false;
  }

  // withoutScope: true -> disable __scope filter
  if (withoutScope) {
    merged[SCOPE_FILTER_NAME] = false;
  }

  return merged;
};
