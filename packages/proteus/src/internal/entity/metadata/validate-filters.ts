import type { Dict, Predicate } from "@lindorm/types";
import { EntityMetadataError } from "../errors/EntityMetadataError.js";
import type { MetaField, MetaFilter } from "../types/metadata.js";

/**
 * Extract all field-key references from a Predicate tree.
 * Skips operator keys ($eq, $gt, $and, $or, $not, etc.) and
 * param-placeholder values ("$paramName").
 */
const extractFieldKeys = (predicate: Predicate<Dict>): Set<string> => {
  const keys = new Set<string>();

  const walk = (obj: unknown): void => {
    if (obj == null || typeof obj !== "object") return;
    if (Array.isArray(obj)) {
      for (const item of obj) walk(item);
      return;
    }

    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "$and" || key === "$or") {
        // These contain arrays of sub-predicates
        if (Array.isArray(value)) {
          for (const sub of value) walk(sub);
        }
      } else if (key === "$not") {
        // $not contains a single sub-predicate
        walk(value);
      } else if (key.startsWith("$")) {
        // Operator key ($eq, $gt, $in, etc.) — skip
        continue;
      } else {
        // This is a field key reference
        keys.add(key);
        // Value might be an operator object — walk it for nested predicates
        if (value != null && typeof value === "object" && !Array.isArray(value)) {
          // Check if it's an operator object (all keys start with $)
          const entries = Object.entries(value as Record<string, unknown>);
          const isOperatorObj =
            entries.length > 0 && entries.every(([k]) => k.startsWith("$"));
          if (!isOperatorObj) {
            // Nested predicate — walk it
            walk(value);
          }
        }
      }
    }
  };

  walk(predicate);
  return keys;
};

/**
 * Validate that all filter conditions reference field keys that exist on the entity.
 * Runs at metadata build time (C4) so invalid filters fail early, not at query time.
 */
export const validateFilters = (
  targetName: string,
  filters: Array<MetaFilter>,
  fields: Array<MetaField>,
): void => {
  const fieldKeys = new Set(fields.map((f) => f.key));

  // Check for duplicate filter names
  const seenNames = new Set<string>();
  for (const filter of filters) {
    if (seenNames.has(filter.name)) {
      throw new EntityMetadataError(
        `Duplicate @Filter name "${filter.name}" on entity "${targetName}"`,
        { debug: { target: targetName, filterName: filter.name } },
      );
    }
    seenNames.add(filter.name);

    // Extract and validate field references
    const referencedKeys = extractFieldKeys(filter.condition);
    for (const key of referencedKeys) {
      if (!fieldKeys.has(key)) {
        throw new EntityMetadataError(
          `@Filter("${filter.name}") references unknown field "${key}" on entity "${targetName}". Valid fields: ${[...fieldKeys].join(", ")}`,
          { debug: { target: targetName, filterName: filter.name, invalidField: key } },
        );
      }
    }
  }
};
