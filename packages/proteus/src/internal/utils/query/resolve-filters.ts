import type { Dict, Predicate } from "@lindorm/types";
import type { MetaFilter } from "../../entity/types/metadata.js";
import type { FilterRegistry } from "./filter-registry.js";
import { ProteusError } from "../../../errors/index.js";

/**
 * A resolved filter predicate ready to be applied to a query.
 */
export type ResolvedFilter = {
  name: string;
  predicate: Predicate<Dict>;
};

/**
 * Check if a predicate condition tree contains any `$paramName` placeholder values.
 * Returns true if at least one `$`-prefixed string value is found.
 */
const conditionRequiresParams = (cond: unknown): boolean => {
  if (cond === null || cond === undefined) return false;

  if (typeof cond === "string" && cond.startsWith("$")) {
    return true;
  }

  if (Array.isArray(cond)) {
    return cond.some((item) => conditionRequiresParams(item));
  }

  if (typeof cond === "object") {
    return Object.values(cond as Record<string, unknown>).some((v) =>
      conditionRequiresParams(v),
    );
  }

  return false;
};

/**
 * Replace `$paramName` placeholder strings in a predicate tree with
 * actual values from the params dict.
 *
 * Walks the predicate recursively. Any string value starting with `$`
 * (that is not an operator like `$eq`) is treated as a param reference.
 */
const substituteParams = (
  cond: Predicate<Dict>,
  params: Dict<unknown>,
  filterName: string,
): Predicate<Dict> => {
  const walk = (obj: unknown): unknown => {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === "string" && obj.startsWith("$")) {
      const paramKey = obj.slice(1);
      // Only substitute if it looks like a param reference (not an operator)
      // Operators are at object keys, not values, so we only reach here for values.
      if (!(paramKey in params)) {
        throw new ProteusError(
          `Filter "${filterName}" requires parameter "${paramKey}" but it was not provided`,
        );
      }
      return params[paramKey];
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => walk(item));
    }

    if (typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = walk(value);
      }
      return result;
    }

    return obj;
  };

  return walk(cond) as Predicate<Dict>;
};

/**
 * Resolve which filters are active for a given query, merging:
 * 1. Entity metadata filters (from `@Filter` decorators)
 * 2. Source-level filter registry (enabled/disabled + params)
 * 3. Per-request overrides (from `FindOptions.filters`)
 *
 * Resolution priority (highest to lowest):
 * - Per-request override (`FindOptions.filters[name]`)
 * - Source registry (`source.enableFilter()` / `source.setFilterParams()`)
 * - Decorator default (`@Filter({ default: true })`)
 *
 * **Param-dependent default behavior:** When a filter falls back to its decorator
 * default (no registry entry, no per-request override), and the condition contains
 * `$param` placeholders, the filter is silently skipped if no params are available.
 * This allows `default: true` filters with params (like `__scope`) to auto-activate
 * only when params are registered on the source, without breaking queries that
 * haven't configured scope params yet.
 *
 * Returns an array of resolved predicates ready to be ANDed into the WHERE clause.
 */
export const resolveFilters = (
  entityFilters: Array<MetaFilter>,
  registry: FilterRegistry,
  requestOverrides: Record<string, boolean | Dict<unknown>> | undefined,
): Array<ResolvedFilter> => {
  if (!entityFilters || entityFilters.length === 0) return [];

  // Validate that all user-specified filter overrides reference known filters.
  // System filters (__-prefixed) are silently skipped since they may be injected
  // by mergeSystemFilterOverrides even when the entity has no matching auto-filter.
  if (requestOverrides) {
    const knownNames = new Set(entityFilters.map((f) => f.name));
    for (const name of Object.keys(requestOverrides)) {
      if (!name.startsWith("__") && !knownNames.has(name)) {
        const available = entityFilters
          .map((f) => f.name)
          .filter((n) => !n.startsWith("__"));
        throw new ProteusError(
          `Filter "${name}" does not exist on this entity. Available filters: ${available.join(", ") || "(none)"}`,
        );
      }
    }
  }

  const resolved: Array<ResolvedFilter> = [];

  for (const filter of entityFilters) {
    const override = requestOverrides?.[filter.name];
    const registryEntry = registry.get(filter.name);

    // Determine if this filter is enabled
    let enabled: boolean;
    let params: Dict<unknown>;

    if (override !== undefined) {
      // Per-request override takes highest priority
      if (override === false) {
        // Explicitly disabled for this query
        continue;
      } else if (override === true) {
        // Enabled with source-registered params
        enabled = true;
        params = registryEntry?.params ?? {};
      } else {
        // Dict -- enabled with these params (override source params)
        enabled = true;
        params = override;
      }
    } else if (registryEntry) {
      // Source registry
      enabled = registryEntry.enabled;
      params = registryEntry.params;
    } else {
      // Fall back to decorator default.
      // If the condition requires params and none are available, skip the filter
      // rather than throwing. This allows param-dependent default-on filters
      // (like __scope) to silently deactivate when not configured.
      enabled = filter.default;
      params = {};

      if (
        enabled &&
        Object.keys(params).length === 0 &&
        conditionRequiresParams(filter.condition)
      ) {
        continue;
      }
    }

    if (!enabled) continue;

    // Substitute $param placeholders
    const predicate = substituteParams(filter.condition, params, filter.name);
    resolved.push({ name: filter.name, predicate });
  }

  return resolved;
};
