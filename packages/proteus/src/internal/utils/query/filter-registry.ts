import type { Dict } from "@lindorm/types";

/**
 * Per-filter state tracking enabled/disabled and parameter values.
 */
export type FilterRegistryEntry = {
  params: Dict<unknown>;
  enabled: boolean;
};

/**
 * Lightweight filter state registry.
 *
 * Tracks which named filters are enabled and their parameter values.
 * Stored on ProteusSource and passed through the query pipeline.
 *
 * Filter name collision across entities is intentional (same as Hibernate):
 * two entities with `@Filter({ name: "active" })` both respond to
 * `enableFilter("active")`.
 */
export type FilterRegistry = Map<string, FilterRegistryEntry>;

export const createFilterRegistry = (): FilterRegistry => new Map();

export const cloneFilterRegistry = (source: FilterRegistry): FilterRegistry => {
  const cloned: FilterRegistry = new Map();
  for (const [name, entry] of source) {
    cloned.set(name, { params: { ...entry.params }, enabled: entry.enabled });
  }
  return cloned;
};

export const setFilterParams = (
  registry: FilterRegistry,
  name: string,
  params: Dict<unknown>,
): void => {
  const existing = registry.get(name);
  if (existing) {
    existing.params = { ...existing.params, ...params };
  } else {
    registry.set(name, { params: { ...params }, enabled: true });
  }
};

export const enableFilter = (registry: FilterRegistry, name: string): void => {
  const existing = registry.get(name);
  if (existing) {
    existing.enabled = true;
  } else {
    registry.set(name, { params: {}, enabled: true });
  }
};

export const disableFilter = (registry: FilterRegistry, name: string): void => {
  const existing = registry.get(name);
  if (existing) {
    existing.enabled = false;
  }
};
