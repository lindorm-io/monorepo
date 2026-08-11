import { isArray, isNull, isObject, isObjectLike, isUndefined } from "@lindorm/is";
import type { Condition } from "@lindorm/match";
import type { Filter, Document } from "mongodb";
import type { Dict } from "@lindorm/types";
import { ProteusError } from "../../../../errors/ProteusError.js";
import type { EntityMetadata, MetaField } from "../../../entity/types/metadata.js";
import type { FilterRegistry } from "../../../utils/query/filter-registry.js";
import { generateAutoFilters } from "../../../entity/metadata/auto-filters.js";
import { resolveFilters } from "../../../utils/query/resolve-filters.js";
import { mergeSystemFilterOverrides } from "../../../utils/query/merge-system-filter-overrides.js";
import { resolveColumnNameSafe } from "../../../utils/sql/resolve-column-name.js";

/**
 * Resolve the MongoDB field name for a given entity field key.
 *
 * - Single PK: maps to _id directly
 * - Composite PK: maps to _id.fieldKey (dot notation) so partial
 *   compound key lookups work correctly
 * - Non-PK fields: the shared key→column resolver, relation join keys included
 *   so a criterion on an auto-projected FK addresses the real document key
 */
const resolveMongoFieldName = (fieldKey: string, metadata: EntityMetadata): string => {
  if (metadata.primaryKeys.includes(fieldKey)) {
    if (metadata.primaryKeys.length === 1) return "_id";
    return `_id.${fieldKey}`;
  }

  return resolveColumnNameSafe(metadata.fields, fieldKey, metadata.relations);
};

const findField = (fieldKey: string, metadata: EntityMetadata): MetaField | undefined => {
  return metadata.fields.find((f) => f.key === fieldKey);
};

/**
 * An `$and` / `$or` payload must be a NON-EMPTY array. An empty one is an error
 * rather than an identity element: omitting the key already spells "no
 * constraint", and it spells it the same way under either operator — where `[]`
 * would mean "everything" under `$and` and "nothing" under `$or`. MongoDB also
 * rejects an empty one outright, so it could never reach the server.
 */
const requireMembers = (operator: string, payload: unknown): Array<unknown> => {
  if (!isArray<unknown>(payload)) {
    throw new ProteusError(`Operator "${operator}" requires an array`, {
      code: "invalid_operator_payload",
      title: "Invalid Operator Payload",
      details: "The operator was given a payload of the wrong shape.",
      data: { operator },
    });
  }
  if (payload.length === 0) {
    throw new ProteusError(
      `Operator "${operator}" requires at least one member — omit the key to place no constraint`,
      {
        code: "invalid_operator_payload",
        title: "Invalid Operator Payload",
        details:
          "An empty logical array is not an identity element. Omit the key, or pass undefined, to place no constraint.",
        data: { operator },
      },
    );
  }
  return payload;
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
      // An inner condition that constrains nothing matches every document, so
      // its negation matches none — the rule the SQL compilers apply to an empty
      // `$not`. MongoDB rejects one outright ("$not argument must be a non-empty
      // object"), so the constant is required here, not merely tidier.
      if (isObjectLike(value) && Object.keys(value as Dict).length === 0) {
        return { $expr: false };
      }
      // `$nor` over the compiled inner negates EVERY shape. MongoDB's
      // field-level `$not` takes only a document or a regex, so a compiled plain
      // equality, a Date, or an `$and`/`$expr` fan-out (decimal `$between`,
      // `$has`, `$contained`) cannot pass through it. `$nor` also keeps
      // documents whose field is null or missing, which is the two-valued
      // negation the criteria language means.
      return { $nor: [compileValue(mongoField, value, field, mongoField)] };
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
      if (isObjectLike(value)) {
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
  fieldKey: string,
): Filter<Document> => {
  if (isNull(value)) {
    return { [mongoField]: null };
  }

  if (isObjectLike(value) && !(value instanceof Date) && !(value instanceof RegExp)) {
    const obj = value as Record<string, unknown>;

    // `undefined` is stripped BEFORE any shape is read: it means "not
    // specified". The strip and the empty-bag throw below are ONE change —
    // stripping alone leaves a field unconstrained, which on a delete is a
    // table wipe.
    const supplied = Object.entries(obj).filter(([, operand]) => !isUndefined(operand));
    const keys = supplied.map(([key]) => key);

    // Check if it's an operator object (all keys start with $)
    if (keys.length > 0 && keys.every((k) => k.startsWith("$"))) {
      if (keys.length === 1) {
        return compileOperator(mongoField, keys[0], obj[keys[0]], field);
      }

      // Multiple operators on same field -> $and
      const conditions = keys.map((k) => compileOperator(mongoField, k, obj[k], field));
      return { $and: conditions };
    }

    // Naming a field is a statement that you are constraining it; an empty
    // operator bag contradicts that. Root `{}` is the opposite and stays
    // legitimate — it names no field, so `find({})` still means every document.
    if (keys.length === 0) {
      throw new ProteusError(
        `Condition on field "${fieldKey}" requires at least one operator`,
        {
          code: "invalid_operator_payload",
          title: "Invalid Operator Payload",
          details:
            "A named field with an empty operator bag constrains nothing. Omit the key, or pass undefined, to place no constraint.",
          data: { field: fieldKey },
        },
      );
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
  criteria: Condition<E>,
  metadata: EntityMetadata,
): Filter<Document> => {
  const filter: Filter<Document> = {};
  const andConditions: Array<Filter<Document>> = [];

  for (const [key, value] of Object.entries(criteria as Record<string, unknown>)) {
    // `undefined` means "the key was not supplied", so the field is not
    // constrained. It is NOT `null`, which asks for documents whose field IS
    // null.
    if (isUndefined(value)) continue;

    if (key === "$and") {
      const subConditions = requireMembers(key, value).map((c) =>
        compileFilter(c as Condition<E>, metadata),
      );
      andConditions.push({ $and: subConditions });
      continue;
    }

    if (key === "$or") {
      const subConditions = requireMembers(key, value).map((c) =>
        compileFilter(c as Condition<E>, metadata),
      );
      andConditions.push({ $or: subConditions });
      continue;
    }

    // A CRITERIA-level `$not` negates a whole sub-predicate — the same thing the
    // SQL drivers compile to `NOT (…)` and the in-memory drivers evaluate as
    // `!matches(…)`. MongoDB has no top-level `$not` (the server rejects it with
    // "unknown top level operator"); `$nor` over a single expression is the
    // documented way to negate one. The FIELD-level `{ field: { $not: … } }` form
    // is a different operator and stays in `compileOperator`.
    if (key === "$not") {
      if (!isObject(value)) {
        throw new ProteusError(`Operator "${key}" requires an object payload`, {
          code: "invalid_operator_payload",
          title: "Invalid Operator Payload",
          details:
            "A criteria-level $not negates a whole sub-condition, so it takes a condition object.",
          data: { operator: key },
        });
      }
      andConditions.push({ $nor: [compileFilter(value as Condition<E>, metadata)] });
      continue;
    }

    const mongoField = resolveMongoFieldName(key, metadata);
    const field = findField(key, metadata);
    const compiled = compileValue(mongoField, value, field, key);

    // Merge compiled conditions. `$nor` joins the operator-keyed list: a
    // field-level `$not` compiles to one, and two of them in the same criteria
    // object would otherwise overwrite each other on the single `$nor` key.
    for (const [ck, cv] of Object.entries(compiled)) {
      if (ck === "$and" || ck === "$or" || ck === "$nor" || ck === "$expr") {
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
  criteria: Condition<E>,
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
