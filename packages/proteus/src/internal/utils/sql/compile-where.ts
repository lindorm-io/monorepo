import type { Condition, ConditionOperator } from "@lindorm/match";
import {
  ConditionOperatorKey,
  LogicalOperatorKey,
  isConditionOperatorKey,
  isLogicalOperatorKey,
} from "@lindorm/match";
import {
  isArray,
  isNull,
  isObject,
  isObjectLike,
  isRegExp,
  isUndefined,
} from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata, MetaField } from "../../entity/types/metadata.js";
import type { PredicateEntry } from "../../types/query.js";
import { NotSupportedError, ProteusError } from "../../../errors/index.js";
import type { CompiledCondition } from "./compiled-condition.js";
import {
  ALWAYS_FALSE,
  compiledClause,
  conjoin,
  disjoin,
  negate,
  renderCondition,
} from "./compiled-condition.js";
import { resolveColumnName } from "./resolve-column-name.js";
import type { SqlDialect } from "./sql-dialect.js";

/**
 * The operator vocabulary comes from `@lindorm/match`, which OWNS the condition
 * language. A hand-maintained copy here was a third list across two packages,
 * and it is how `$and` / `$or` came to have no branch at all.
 */
const hasPredicateOperator = (obj: Record<string, unknown>): boolean =>
  Object.keys(obj).some(
    (key) => isConditionOperatorKey(key) || isLogicalOperatorKey(key),
  );

const guardArrayField = (
  operator: string,
  field: MetaField | null,
  fieldKey: string,
): void => {
  if (!field) return; // join key columns — skip guard (no field metadata available)
  if (field.type === "array") return;
  throw new ProteusError(
    `Operator "${operator}" requires an array-typed column, but field "${fieldKey}" has type "${field.type}"`,
    {
      code: "invalid_operator_type",
      title: "Invalid Operator Type",
      details:
        "This operator requires an array-typed column; the target field has a different type.",
      data: { operator, field: fieldKey, fieldType: field.type },
    },
  );
};

/**
 * A bare nested object is JSON containment, so the column has to hold JSON
 * KEYS. An `array` column does not: the condition language reads
 * `{ tags: { city: "Oslo" } }` as "the value is an object whose `city` is
 * Oslo", which an array value never is. Every other type has no nested shape
 * at all.
 *
 * Refusing is the point — falling through emitted NO clause, so a fully typed
 * condition returned the whole table.
 */
const guardObjectField = (field: MetaField | null, fieldKey: string): void => {
  if (field?.type === "object") return;
  throw new ProteusError(
    `A nested condition requires an object-typed column, but field "${fieldKey}" has type "${field?.type ?? "unknown"}"`,
    {
      code: "invalid_nested_condition",
      title: "Invalid Nested Condition",
      details:
        "A bare nested object matches by JSON containment and needs a column declared as an object. Use an operator instead, or declare the column as an object.",
      data: { field: fieldKey, fieldType: field?.type ?? null },
    },
  );
};

/**
 * A malformed operator payload is an ERROR, not a clause that quietly goes
 * missing. Presence decides that an operator applies; shape decides whether it
 * can be compiled at all.
 */
const malformedPayload = (
  operator: string,
  fieldKey: string,
  expected: string,
): never => {
  throw new ProteusError(
    `Operator "${operator}" on field "${fieldKey}" requires ${expected}`,
    {
      code: "invalid_operator_payload",
      title: "Invalid Operator Payload",
      details:
        "The operator was given a payload of the wrong shape. A payload the compiler cannot read used to be coerced or dropped, which placed no restriction on the query at all.",
      data: { operator, field: fieldKey, expected },
    },
  );
};

/**
 * "Null, or not supplied at all" — the OPERAND side of the null rule.
 *
 * The two sides are different concerns and must not be merged. A null ROW VALUE
 * simply does not match a comparison, which is what SQL already does by dropping
 * the row. A null OPERAND is not orderable: `$gte: null` asks for "greater than
 * or equal to nothing", so it is a malformed payload rather than a query.
 *
 * `undefined` is refused alongside it. The condition language reads `undefined`
 * as "not specified" and strips it, but that strip is only safe together with
 * the named-field empty-bag throw — until both land, refusing is the direction
 * that cannot turn a mistyped criterion into an unrestricted one.
 */
const isAbsent = (operand: unknown): boolean => isNull(operand) || isUndefined(operand);

const requireOrderable = (operator: string, fieldKey: string, operand: unknown): void => {
  if (!isAbsent(operand)) return;
  malformedPayload(operator, fieldKey, "an orderable operand");
};

/**
 * The membership test `$in` performs and `$nin` NEGATES — one compilation, so
 * the two can never disagree.
 *
 * A null MEMBER is a value like any other in the condition language, but `col IN
 * (NULL)` is UNKNOWN for every row: it matched nothing under `$in` and, once
 * `$nin` became a two-valued negation, would have matched EVERYTHING under
 * `$nin`. Nulls are therefore lifted out into an explicit `IS NULL` alternative.
 */
const compileMembership = (
  qualifiedCol: string,
  operand: Array<unknown>,
  params: Array<unknown>,
  dialect: SqlDialect,
): CompiledCondition => {
  // `$in: []` can never hold. It is well-formed and useful — "match nothing" —
  // so it is a state of its own rather than a clause that happens to say FALSE.
  // Negated, it gives `$nin: []` the always-true it needs: an empty exclusion
  // list excludes nothing, which is NOT the same as "nothing to emit", and
  // conflating the two turned `deleteMany({ tag: { $nin: [] } })` into
  // `DELETE FROM t`.
  if (operand.length === 0) return ALWAYS_FALSE;

  const values = operand.filter((value) => !isNull(value));
  const alternatives: Array<CompiledCondition> = [];

  if (values.length > 0) {
    const placeholders = values.map((value) => {
      params.push(value);
      return dialect.placeholder(params);
    });
    alternatives.push(compiledClause(`${qualifiedCol} IN (${placeholders.join(", ")})`));
  }

  if (values.length !== operand.length) {
    alternatives.push(compiledClause(`${qualifiedCol} IS NULL`));
  }

  return disjoin(alternatives);
};

/**
 * A field-level `$and` / `$or` payload must be a NON-EMPTY array. An empty one
 * is an error rather than an identity element: omitting the key already spells
 * "no constraint", and it spells it the same way under either operator — where
 * `[]` would mean "everything" under `$and` and "nothing" under `$or`.
 */
const requireMembers = (
  operator: string,
  fieldKey: string,
  operand: unknown,
): Array<unknown> => {
  if (!isArray<unknown>(operand)) {
    return malformedPayload(operator, fieldKey, "an array");
  }
  if (operand.length === 0) {
    return malformedPayload(
      operator,
      fieldKey,
      "at least one member — omit the key to place no constraint",
    );
  }
  return operand;
};

/**
 * The non-`$` keys of an operator bag, which together form one nested
 * condition. Collected up front so `{ payload: { city, postcode } }` emits ONE
 * containment clause rather than one per key.
 */
const collectNestedKeys = (ops: Record<string, unknown>): Dict => {
  const nested: Dict = {};
  for (const [key, operand] of Object.entries(ops)) {
    if (key.startsWith("$")) continue;
    nested[key] = operand;
  }
  return nested;
};

/**
 * Optional map from field key to table alias override.
 * Used by joined inheritance to route child-only fields to their correct table alias.
 */
export type FieldAliasOverrides = Map<string, string>;

export const compileWhere = <E extends IEntity>(
  entries: Array<PredicateEntry<E>>,
  metadata: EntityMetadata,
  tableAlias: string | null,
  params: Array<unknown>,
  dialect: SqlDialect,
  fieldAliasOverrides?: FieldAliasOverrides,
): string => {
  if (entries.length === 0) return "";

  const clauses: Array<string> = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    // An empty render means ONE thing now — the entry places no restriction — so
    // skipping it is correct rather than accidentally correct.
    const compiled = renderCondition(
      compilePredicate(
        entry.predicate as Condition<Dict>,
        metadata,
        tableAlias,
        params,
        dialect,
        fieldAliasOverrides,
      ),
    );
    if (!compiled) continue;

    if (clauses.length === 0) {
      clauses.push(compiled);
    } else {
      const conjunction = entry.conjunction === "or" ? "OR" : "AND";
      clauses.push(`${conjunction} ${compiled}`);
    }
  }

  if (clauses.length === 0) return "";
  return `WHERE ${clauses.join(" ")}`;
};

export const compilePredicate = (
  predicate: Condition<Dict>,
  metadata: EntityMetadata,
  tableAlias: string | null,
  params: Array<unknown>,
  dialect: SqlDialect,
  fieldAliasOverrides?: FieldAliasOverrides,
): CompiledCondition => {
  const parts: Array<CompiledCondition> = [];

  const compileSub = (sub: unknown): CompiledCondition =>
    compilePredicate(
      sub as Condition<Dict>,
      metadata,
      tableAlias,
      params,
      dialect,
      fieldAliasOverrides,
    );

  if (predicate.$and) {
    parts.push(conjoin(predicate.$and.map(compileSub)));
  }

  if (predicate.$or) {
    parts.push(disjoin(predicate.$or.map(compileSub)));
  }

  if (predicate.$not) {
    parts.push(negate(compileSub(predicate.$not)));
  }

  for (const [key, value] of Object.entries(predicate)) {
    if (isLogicalOperatorKey(key)) continue;

    // Embedded parent key expansion — must run BEFORE resolveColumnName
    // which would throw for parent keys like "address" that have no direct column.
    const embeddedChildren = metadata.fields.filter((f) => f.embedded?.parentKey === key);
    if (
      embeddedChildren.length > 0 &&
      isObjectLike(value) &&
      !hasPredicateOperator(value as Record<string, unknown>)
    ) {
      for (const [childKey, childValue] of Object.entries(
        value as Record<string, unknown>,
      )) {
        const childField = embeddedChildren.find((f) => f.key === `${key}.${childKey}`);
        if (!childField) continue;
        const effectiveChildAlias =
          fieldAliasOverrides?.get(childField.key) ?? tableAlias;
        const qualifiedChildCol = effectiveChildAlias
          ? `${dialect.quoteIdentifier(effectiveChildAlias)}.${dialect.quoteIdentifier(childField.name)}`
          : dialect.quoteIdentifier(childField.name);
        parts.push(
          ...compileFieldCondition(
            qualifiedChildCol,
            childValue,
            params,
            childField,
            childField.key,
            dialect,
          ),
        );
      }
      continue;
    }

    const colName = resolveColumnName(metadata.fields, key, metadata.relations);
    // For joined inheritance, child-only fields may live on a different table alias
    const effectiveAlias = fieldAliasOverrides?.get(key) ?? tableAlias;
    const qualifiedCol = effectiveAlias
      ? `${dialect.quoteIdentifier(effectiveAlias)}.${dialect.quoteIdentifier(colName)}`
      : dialect.quoteIdentifier(colName);

    const field = metadata.fields.find((f) => f.key === key) ?? null;

    parts.push(
      ...compileFieldCondition(qualifiedCol, value, params, field, key, dialect),
    );
  }

  return conjoin(parts);
};

/**
 * Compile ONE column's condition value — the unit a field name maps to, and the
 * same unit a member of a field-level `$and` / `$or` is. Both call sites read a
 * value the same way, so `{ score: { $gt: 5 } }` and
 * `{ score: { $or: [{ $gt: 5 }, 0] } }` agree on what each member means.
 *
 * An ARRAY of conditions rather than one is returned so that a multi-operator
 * bag stays flat in its parent conjunction: `{ name: "x", age: { $gt: 1, $lt: 9 } }`
 * is one three-way AND, not an AND holding an AND.
 */
const compileFieldCondition = (
  qualifiedCol: string,
  value: unknown,
  params: Array<unknown>,
  field: MetaField | null,
  fieldKey: string,
  dialect: SqlDialect,
): Array<CompiledCondition> => {
  if (value === null || value === undefined) {
    return [compiledClause(`${qualifiedCol} IS NULL`)];
  }

  // `isObject` is decided by PROTOTYPE, so a Date, a Buffer and a RegExp are
  // values here rather than operator bags.
  if (isObject(value)) {
    return compileOperator(
      qualifiedCol,
      value as ConditionOperator<unknown>,
      params,
      field,
      fieldKey,
      dialect,
    );
  }

  params.push(value);
  return [compiledClause(`${qualifiedCol} = ${dialect.placeholder(params)}`)];
};

const compileOperator = (
  qualifiedCol: string,
  ops: ConditionOperator<unknown>,
  params: Array<unknown>,
  field: MetaField | null,
  fieldKey: string,
  dialect: SqlDialect,
): Array<CompiledCondition> => {
  const compiled: Array<CompiledCondition> = [];
  let nestedEmitted = false;

  for (const [key, operand] of Object.entries(ops)) {
    if (isConditionOperatorKey(key) || isLogicalOperatorKey(key)) {
      compiled.push(
        compileOperatorKey(qualifiedCol, key, operand, params, field, fieldKey, dialect),
      );
      continue;
    }

    if (key.startsWith("$")) {
      throw new NotSupportedError(`Unknown operator "${key}"`, {
        code: "unknown_operator",
        title: "Unknown Operator",
        details:
          "The operator is not part of the condition language. An unrecognised operator used to compile to no clause at all, which matched every row.",
        data: { operator: key, field: fieldKey },
      });
    }

    // A bare nested object on a NON-embedded column — `{ payload: { city: "x" } }`
    // — means PARTIAL MATCH: any row whose `payload.city` is "x", whatever else
    // the document holds. That is exactly JSON containment, which every dialect
    // already emits for `$has`, so the two spell one semantic.
    //
    // For an EMBEDDED parent key the same semantic is column expansion instead,
    // and it is resolved before this function is reached.
    if (nestedEmitted) continue;

    guardObjectField(field, fieldKey);
    compiled.push(
      compiledClause(dialect.compileHas(qualifiedCol, params, collectNestedKeys(ops))),
    );
    nestedEmitted = true;
  }

  return compiled;
};

const compileOperatorKey = (
  qualifiedCol: string,
  key: ConditionOperatorKey | LogicalOperatorKey,
  operand: any,
  params: Array<unknown>,
  field: MetaField | null,
  fieldKey: string,
  dialect: SqlDialect,
): CompiledCondition => {
  switch (key) {
    case ConditionOperatorKey.Eq: {
      if (operand === null || operand === undefined) {
        return compiledClause(`${qualifiedCol} IS NULL`);
      }
      params.push(operand);
      return compiledClause(`${qualifiedCol} = ${dialect.placeholder(params)}`);
    }

    case ConditionOperatorKey.Neq: {
      if (operand === null || operand === undefined) {
        return compiledClause(`${qualifiedCol} IS NOT NULL`);
      }
      // NOT `<>`. SQL's inequality is three-valued: against a NULL column it is
      // UNKNOWN and the row is DROPPED, while the condition language is
      // two-valued and KEEPS it — a row whose column is null is not equal to the
      // operand, so negating that equality keeps it. `$neq` is therefore the
      // negation of `$eq`, compiled once and negated, rather than a second
      // comparison that happens to disagree on NULL.
      params.push(operand);
      return negate(compiledClause(`${qualifiedCol} = ${dialect.placeholder(params)}`));
    }

    case ConditionOperatorKey.Gt:
      requireOrderable(key, fieldKey, operand);
      params.push(operand);
      return compiledClause(`${qualifiedCol} > ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Gte:
      requireOrderable(key, fieldKey, operand);
      params.push(operand);
      return compiledClause(`${qualifiedCol} >= ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Lt:
      requireOrderable(key, fieldKey, operand);
      params.push(operand);
      return compiledClause(`${qualifiedCol} < ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Lte:
      requireOrderable(key, fieldKey, operand);
      params.push(operand);
      return compiledClause(`${qualifiedCol} <= ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Between: {
      if (isAbsent(operand)) {
        return malformedPayload(key, fieldKey, "two orderable bounds");
      }
      const [low, high] = operand as [unknown, unknown];
      if (isAbsent(low) || isAbsent(high)) {
        return malformedPayload(key, fieldKey, "two orderable bounds");
      }
      params.push(low);
      const lowPlaceholder = dialect.placeholder(params);
      params.push(high);
      const highPlaceholder = dialect.placeholder(params);
      return compiledClause(
        `${qualifiedCol} BETWEEN ${lowPlaceholder} AND ${highPlaceholder}`,
      );
    }

    case ConditionOperatorKey.In:
      return compileMembership(qualifiedCol, operand as Array<unknown>, params, dialect);

    // NOT `NOT IN`. Like `<>`, it is three-valued and drops the rows the
    // condition language keeps: a row whose column is null is not one of the
    // listed values. Negating the SAME membership test `$in` compiles is what
    // makes the pair agree by construction — and it carries the empty-list
    // states across for free, since the negation of always-false is always-true.
    case ConditionOperatorKey.Nin:
      return negate(
        compileMembership(qualifiedCol, operand as Array<unknown>, params, dialect),
      );

    case ConditionOperatorKey.Like:
      params.push(operand);
      return compiledClause(`${qualifiedCol} LIKE ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Ilike:
      return compiledClause(dialect.compileIlike(qualifiedCol, params, operand));

    case ConditionOperatorKey.Similar:
      return compiledClause(dialect.compileSimilar(qualifiedCol, params, operand));

    case ConditionOperatorKey.Regex: {
      // The language declares a `RegExp`. A string used to be handed to
      // `new RegExp(String(operand))`, which silently accepted a payload the
      // matcher refuses — and turned `undefined` into the pattern
      // `/undefined/`.
      if (!isRegExp(operand)) return malformedPayload(key, fieldKey, "a RegExp");

      const result = dialect.compileRegex(qualifiedCol, params, operand);
      if (result === null) {
        throw new NotSupportedError(
          "The $regex operator is not supported by this driver",
          {
            code: "unsupported_operator",
            title: "Unsupported Operator",
            details:
              "The $regex operator is not supported by the active database driver.",
            data: { operator: "$regex" },
          },
        );
      }
      return compiledClause(result);
    }

    case ConditionOperatorKey.Exists:
      return compiledClause(
        operand ? `${qualifiedCol} IS NOT NULL` : `${qualifiedCol} IS NULL`,
      );

    case ConditionOperatorKey.All:
      guardArrayField(key, field, fieldKey);
      return compiledClause(
        dialect.compileAll(qualifiedCol, params, operand as Array<unknown>, field),
      );

    case ConditionOperatorKey.Overlap:
      guardArrayField(key, field, fieldKey);
      return compiledClause(
        dialect.compileOverlap(qualifiedCol, params, operand as Array<unknown>, field),
      );

    case ConditionOperatorKey.Contained:
      guardArrayField(key, field, fieldKey);
      return compiledClause(
        dialect.compileContained(qualifiedCol, params, operand as Array<unknown>, field),
      );

    case ConditionOperatorKey.Length:
      return compiledClause(dialect.compileLength(qualifiedCol, params, operand, field));

    case ConditionOperatorKey.Has:
      return compiledClause(dialect.compileHas(qualifiedCol, params, operand));

    case ConditionOperatorKey.Mod: {
      if (isAbsent(operand)) {
        return malformedPayload(key, fieldKey, "a divisor and a remainder");
      }
      const [divisor, remainder] = operand as [number, number];
      if (isAbsent(divisor) || isAbsent(remainder)) {
        return malformedPayload(key, fieldKey, "a divisor and a remainder");
      }
      params.push(divisor);
      const divisorPlaceholder = dialect.placeholder(params);
      params.push(remainder);
      const remainderPlaceholder = dialect.placeholder(params);
      return compiledClause(
        `(${qualifiedCol} % ${divisorPlaceholder}) = ${remainderPlaceholder}`,
      );
    }

    case LogicalOperatorKey.Not: {
      // A FIELD-level `$not` negates ONE column's condition — a different
      // operator from the criteria-level `$not` handled in `compilePredicate`.
      //
      // PRESENCE decides it applies; the payload must be an object. The
      // truthiness test this replaces emitted NOTHING for a falsy payload, so
      // `{ published: { $not: false } }` — the natural way to write "published
      // is true", and fully typed — placed no restriction at all and turned
      // `deleteMany` into `DELETE FROM t`. The non-object coercion it also
      // replaces implemented an undeclared `$not: <primitive>` shorthand.
      if (!isObject(operand)) {
        return malformedPayload(key, fieldKey, "an object payload");
      }

      return negate(
        conjoin(
          compileOperator(
            qualifiedCol,
            operand as ConditionOperator<unknown>,
            params,
            field,
            fieldKey,
            dialect,
          ),
        ),
      );
    }

    // A field-level `$and` / `$or` combines conditions over THE SAME column, and
    // is AND-ed with its siblings like any other key — `{ score: { $not: { $lt: 15 },
    // $lt: 25 } }` means both. Each member is read exactly as a field's own
    // condition value is, so a bare value member is an equality.
    case LogicalOperatorKey.And:
      return conjoin(
        requireMembers(key, fieldKey, operand).map((member) =>
          conjoin(
            compileFieldCondition(qualifiedCol, member, params, field, fieldKey, dialect),
          ),
        ),
      );

    case LogicalOperatorKey.Or:
      return disjoin(
        requireMembers(key, fieldKey, operand).map((member) =>
          conjoin(
            compileFieldCondition(qualifiedCol, member, params, field, fieldKey, dialect),
          ),
        ),
      );

    default: {
      const exhaustive: never = key;
      throw new NotSupportedError(`Unknown operator "${String(exhaustive)}"`, {
        code: "unknown_operator",
        title: "Unknown Operator",
        details: "The operator is not part of the condition language.",
        data: { operator: String(exhaustive), field: fieldKey },
      });
    }
  }
};
