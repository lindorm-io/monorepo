import { isArray, isNull, isObject, isObjectLike, isUndefined } from "@lindorm/is";
import type { Condition } from "@lindorm/match";
import {
  ConditionOperatorKey,
  LogicalOperatorKey,
  isConditionOperatorKey,
  isLogicalOperatorKey,
} from "@lindorm/match";
import type { Filter, Document } from "mongodb";
import type { Dict } from "@lindorm/types";
import { NotSupportedError } from "../../../../errors/NotSupportedError.js";
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
 *
 * The `switch` is exhaustive over the vocabulary `@lindorm/match` owns, so a new
 * operator is a BUILD failure here rather than a key forwarded verbatim to the
 * server. A catch-all default is what let `$exists` — the condition language's
 * NOT NULL test — arrive at MongoDB as its own KEY-PRESENCE operator, which on
 * documents written with an explicit null for every declared field matched every
 * document for `true` and none for `false`.
 */
const compileOperator = (
  mongoField: string,
  operator: ConditionOperatorKey | LogicalOperatorKey,
  value: unknown,
  field: MetaField | undefined,
): Filter<Document> => {
  switch (operator) {
    // NOT NULL, never key presence. `$eq: null` is MongoDB's own "null or
    // missing", which is exactly the row-value absence the language means, and
    // `$ne: null` is its complement — so an empty list or an empty string is
    // PRESENT, where key presence could not tell the two apart.
    case ConditionOperatorKey.Exists:
      return value ? { [mongoField]: { $ne: null } } : { [mongoField]: { $eq: null } };

    case ConditionOperatorKey.Eq:
      return { [mongoField]: { $eq: value } };

    case ConditionOperatorKey.Neq:
      return { [mongoField]: { $ne: value } };

    case ConditionOperatorKey.Gt:
    case ConditionOperatorKey.Gte:
    case ConditionOperatorKey.Lt:
    case ConditionOperatorKey.Lte:
      if (isDecimalField(field)) {
        return {
          $expr: {
            [operator]: [{ $toDouble: `$${mongoField}` }, Number(value)],
          },
        };
      }
      return { [mongoField]: { [operator]: value } };

    case ConditionOperatorKey.In:
      return { [mongoField]: { $in: value as Array<unknown> } };

    case ConditionOperatorKey.Nin:
      return { [mongoField]: { $nin: value as Array<unknown> } };

    case ConditionOperatorKey.Like: {
      const regex = likeToRegex(value as string);
      return { [mongoField]: { $regex: regex } };
    }

    case ConditionOperatorKey.Ilike: {
      const regex = likeToRegex(value as string);
      return { [mongoField]: { $regex: regex, $options: "i" } };
    }

    case ConditionOperatorKey.Between: {
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

    case LogicalOperatorKey.Not: {
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

    case ConditionOperatorKey.Regex: {
      if (value instanceof RegExp) {
        return { [mongoField]: { $regex: value.source, $options: value.flags } };
      }
      return { [mongoField]: { $regex: value as string } };
    }

    // Complex predicate operators
    case ConditionOperatorKey.Has: {
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

    case ConditionOperatorKey.All:
      return { [mongoField]: { $all: value as Array<unknown> } };

    case ConditionOperatorKey.Overlap: {
      // Check if any element in the source array exists in the target
      const arr = value as Array<unknown>;
      return { [mongoField]: { $in: arr } };
    }

    case ConditionOperatorKey.Contained: {
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

    case ConditionOperatorKey.Length:
      return { [mongoField]: { $size: value as number } };

    // MongoDB's own `$mod` takes the same `[divisor, remainder]` tuple and means
    // the same thing.
    case ConditionOperatorKey.Mod:
      return { [mongoField]: { $mod: value as [number, number] } };

    // PostgreSQL pg_trgm trigram search. MongoDB has no equivalent, so it is
    // refused here rather than sent to the server as an unknown key — the same
    // treatment the non-Postgres SQL dialects give it.
    case ConditionOperatorKey.Similar:
      throw new NotSupportedError(`Operator "${operator}" is not supported by MongoDB`, {
        code: "unsupported_operator",
        title: "Unsupported Operator",
        details:
          "$similar is PostgreSQL trigram search and has no MongoDB equivalent. Use $regex or $ilike.",
        data: { operator, field: mongoField },
      });

    // A FIELD-level `$and` / `$or` combines conditions over ONE column. The
    // MongoDB compiler does not carry it — the driver declares that gap rather
    // than forwarding the key, which the server reads as a field operator and
    // which used to negate or match nothing at all.
    case LogicalOperatorKey.And:
    case LogicalOperatorKey.Or:
      throw new NotSupportedError(
        `Field-level operator "${operator}" is not supported by MongoDB`,
        {
          code: "unsupported_operator",
          title: "Unsupported Operator",
          details:
            "A field-level $and / $or is not compiled by the MongoDB driver. Combine the conditions at criteria level instead.",
          data: { operator, field: mongoField },
        },
      );

    default: {
      const exhaustive: never = operator;
      throw new NotSupportedError(`Unknown operator "${String(exhaustive)}"`, {
        code: "unknown_operator",
        title: "Unknown Operator",
        details: "The operator is not part of the condition language.",
        data: { operator: String(exhaustive), field: mongoField },
      });
    }
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
      const compile = (key: string): Filter<Document> => {
        // An unrecognised `$` key is refused rather than forwarded. Forwarding it
        // hands MongoDB an operator the condition language never defined — a
        // silent mistranslation on the shapes MongoDB happens to accept, and a
        // server error dressed as a proteus one on the rest.
        if (!isConditionOperatorKey(key) && !isLogicalOperatorKey(key)) {
          throw new NotSupportedError(`Unknown operator "${key}"`, {
            code: "unknown_operator",
            title: "Unknown Operator",
            details: "The operator is not part of the condition language.",
            data: { operator: key, field: fieldKey },
          });
        }
        return compileOperator(mongoField, key, obj[key], field);
      };

      if (keys.length === 1) return compile(keys[0]);

      // Multiple operators on same field -> $and
      return { $and: keys.map(compile) };
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
 * - All comparison operators ($eq, $neq, $gt, etc.)
 * - Pattern matching ($like -> $regex, $ilike -> $regex with "i")
 * - Range operators ($between)
 * - Null checks ($exists — NOT NULL, never key presence)
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
