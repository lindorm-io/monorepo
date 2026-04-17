import type { Filter, Document } from "mongodb";
import type { Dict, Predicate } from "@lindorm/types";
import type { EntityMetadata, MetaField } from "../../../entity/types/metadata";
import type { FilterRegistry } from "../../../utils/query/filter-registry";
import { generateAutoFilters } from "../../../entity/metadata/auto-filters";
import { resolveFilters } from "../../../utils/query/resolve-filters";
import { mergeSystemFilterOverrides } from "../../../utils/query/merge-system-filter-overrides";

/**
 * Resolve the MongoDB field name for a given entity field key.
 *
 * - Single PK: maps to _id directly
 * - Composite PK: maps to _id.fieldKey (dot notation) so partial
 *   compound key lookups work correctly
 * - Non-PK fields: use the metadata name
 */
const resolveMongoFieldName = (fieldKey: string, metadata: EntityMetadata): string => {
  if (metadata.primaryKeys.includes(fieldKey)) {
    if (metadata.primaryKeys.length === 1) return "_id";
    return `_id.${fieldKey}`;
  }

  const field = metadata.fields.find((f) => f.key === fieldKey);
  return field?.name ?? fieldKey;
};

const findField = (fieldKey: string, metadata: EntityMetadata): MetaField | undefined => {
  return metadata.fields.find((f) => f.key === fieldKey);
};

const isDecimalField = (field: MetaField | undefined): boolean => {
  return field?.type === "decimal";
};

/**
 * Convert a SQL LIKE pattern to a MongoDB regex pattern.
 * SQL % -> regex .*, SQL _ -> regex .
 */
const likeToRegex = (pattern: string): string => {
  // Escape regex special chars, then convert SQL wildcards
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");

  // Anchor: ^...$ for exact match semantics, but .* at boundaries handles %
  return `^${escaped}$`;
};

/**
 * Compile a single operator value into a MongoDB filter condition.
 */
const compileOperator = (
  mongoField: string,
  operator: string,
  value: unknown,
  field: MetaField | undefined,
): Filter<Document> => {
  switch (operator) {
    case "$eq":
      return { [mongoField]: { $eq: value } };

    case "$ne":
    case "$neq":
      return { [mongoField]: { $ne: value } };

    case "$gt":
    case "$gte":
    case "$lt":
    case "$lte":
      if (isDecimalField(field)) {
        return {
          $expr: {
            [operator]: [{ $toDouble: `$${mongoField}` }, Number(value)],
          },
        };
      }
      return { [mongoField]: { [operator]: value } };

    case "$in":
      return { [mongoField]: { $in: value as Array<unknown> } };

    case "$nin":
      return { [mongoField]: { $nin: value as Array<unknown> } };

    case "$like": {
      const regex = likeToRegex(value as string);
      return { [mongoField]: { $regex: regex } };
    }

    case "$ilike": {
      const regex = likeToRegex(value as string);
      return { [mongoField]: { $regex: regex, $options: "i" } };
    }

    case "$between": {
      const [low, high] = value as [unknown, unknown];
      if (isDecimalField(field)) {
        return {
          $and: [
            { $expr: { $gte: [{ $toDouble: `$${mongoField}` }, Number(low)] } },
            { $expr: { $lte: [{ $toDouble: `$${mongoField}` }, Number(high)] } },
          ],
        };
      }
      return { [mongoField]: { $gte: low, $lte: high } };
    }

    case "$isNull":
      return value ? { [mongoField]: { $eq: null } } : { [mongoField]: { $ne: null } };

    case "$not": {
      const compiled = compileValue(mongoField, value, field);
      if ("$expr" in compiled) {
        return { $nor: [compiled] };
      }
      return { [mongoField]: { $not: compiled[mongoField] } };
    }

    case "$regex": {
      if (value instanceof RegExp) {
        return { [mongoField]: { $regex: value.source, $options: value.flags } };
      }
      return { [mongoField]: { $regex: value as string } };
    }

    // Complex predicate operators
    case "$has": {
      // JSON containment — check if document field contains the given key/value pairs
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        const conditions: Array<Filter<Document>> = [];
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          conditions.push({ [`${mongoField}.${k}`]: v });
        }
        return conditions.length === 1 ? conditions[0] : { $and: conditions };
      }
      // For arrays, check if the array contains the value
      return { [mongoField]: value };
    }

    case "$all":
      return { [mongoField]: { $all: value as Array<unknown> } };

    case "$overlap": {
      // Check if any element in the source array exists in the target
      const arr = value as Array<unknown>;
      return { [mongoField]: { $in: arr } };
    }

    case "$contained": {
      // All elements of source must exist in target — no extra elements
      // MongoDB doesn't have a direct operator; use $not $elemMatch $nin
      const arr = value as Array<unknown>;
      return {
        $and: [
          { [mongoField]: { $not: { $elemMatch: { $nin: arr } } } },
          { [mongoField]: { $exists: true } },
        ],
      };
    }

    case "$length":
      return { [mongoField]: { $size: value as number } };

    default:
      return { [mongoField]: { [operator]: value } };
  }
};

/**
 * Compile a value (which may be a plain value or an operator object) into a filter.
 */
const compileValue = (
  mongoField: string,
  value: unknown,
  field: MetaField | undefined,
): Filter<Document> => {
  if (value === null || value === undefined) {
    return { [mongoField]: null };
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !(value instanceof RegExp)
  ) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Check if it's an operator object (all keys start with $)
    if (keys.length > 0 && keys.every((k) => k.startsWith("$"))) {
      if (keys.length === 1) {
        return compileOperator(mongoField, keys[0], obj[keys[0]], field);
      }

      // Multiple operators on same field -> $and
      const conditions = keys.map((k) => compileOperator(mongoField, k, obj[k], field));
      return { $and: conditions };
    }
  }

  // Plain equality
  return { [mongoField]: value };
};

/**
 * Compile a Proteus criteria predicate into a MongoDB filter document.
 *
 * Handles:
 * - Field name mapping (entity key -> DB name, PK -> _id)
 * - All comparison operators ($eq, $ne, $gt, etc.)
 * - Pattern matching ($like -> $regex, $ilike -> $regex with "i")
 * - Range operators ($between)
 * - Null checks ($isNull)
 * - Logical operators ($and, $or, $not)
 * - Complex predicates ($has, $all, $overlap, $contained, $length)
 * - Decimal field comparisons via $expr + $toDouble
 */
export const compileFilter = <E extends Dict = Dict>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
): Filter<Document> => {
  const filter: Filter<Document> = {};
  const andConditions: Array<Filter<Document>> = [];

  for (const [key, value] of Object.entries(criteria as Record<string, unknown>)) {
    if (key === "$and") {
      const subConditions = (value as Array<Predicate<E>>).map((c) =>
        compileFilter(c, metadata),
      );
      andConditions.push({ $and: subConditions });
      continue;
    }

    if (key === "$or") {
      const subConditions = (value as Array<Predicate<E>>).map((c) =>
        compileFilter(c, metadata),
      );
      andConditions.push({ $or: subConditions });
      continue;
    }

    const mongoField = resolveMongoFieldName(key, metadata);
    const field = findField(key, metadata);
    const compiled = compileValue(mongoField, value, field);

    // Merge compiled conditions
    for (const [ck, cv] of Object.entries(compiled)) {
      if (ck === "$and" || ck === "$or" || ck === "$expr") {
        andConditions.push({ [ck]: cv });
      } else {
        filter[ck] = cv;
      }
    }
  }

  if (andConditions.length === 0) return filter;
  if (Object.keys(filter).length === 0 && andConditions.length === 1)
    return andConditions[0];

  return {
    $and: [...(Object.keys(filter).length > 0 ? [filter] : []), ...andConditions],
  };
};

/**
 * Build the complete MongoDB filter including system filters
 * (soft-delete, named filters, scope).
 */
export const compileFilterWithSystem = <E extends Dict = Dict>(
  criteria: Predicate<E>,
  metadata: EntityMetadata,
  filterRegistry: FilterRegistry,
  options: {
    withDeleted?: boolean;
    withoutScope?: boolean;
    filters?: Record<string, boolean | Dict<unknown>>;
  } = {},
): Filter<Document> => {
  const userFilter = compileFilter(criteria, metadata);

  // Build system filter conditions
  const systemConditions: Array<Filter<Document>> = [];

  // Named filters from FilterRegistry
  const filterOverrides = mergeSystemFilterOverrides(
    options.filters,
    options.withDeleted ?? false,
    options.withoutScope ?? false,
  );
  const metaFilters = metadata.filters?.length
    ? metadata.filters
    : generateAutoFilters(metadata.fields);
  const resolved = resolveFilters(metaFilters, filterRegistry, filterOverrides);

  // Apply named filter conditions — these operate on entity field keys
  for (const entry of resolved) {
    const filterCondition = compileFilter(entry.predicate, metadata);
    if (Object.keys(filterCondition).length > 0) {
      systemConditions.push(filterCondition);
    }
  }

  // Discriminator filter for single-table inheritance
  if (metadata.inheritance?.discriminatorValue != null) {
    const discField = metadata.inheritance.discriminatorField;
    const discValue = metadata.inheritance.discriminatorValue;
    const mongoField = resolveMongoFieldName(discField, metadata);
    systemConditions.push({ [mongoField]: discValue });
  }

  if (systemConditions.length === 0) return userFilter;

  const allConditions = [
    ...(Object.keys(userFilter).length > 0 ? [userFilter] : []),
    ...systemConditions,
  ];

  if (allConditions.length === 1) return allConditions[0];

  return { $and: allConditions };
};
