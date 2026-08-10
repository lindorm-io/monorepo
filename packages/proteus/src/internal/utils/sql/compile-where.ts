import type { Condition, ConditionOperator } from "@lindorm/match";
import {
  ConditionOperatorKey,
  LogicalOperatorKey,
  isConditionOperatorKey,
  isLogicalOperatorKey,
} from "@lindorm/match";
import { isObject, isObjectLike } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata, MetaField } from "../../entity/types/metadata.js";
import type { PredicateEntry } from "../../types/query.js";
import { NotSupportedError, ProteusError } from "../../../errors/index.js";
import type { CompiledCondition } from "./compiled-condition.js";
import {
  ALWAYS_FALSE,
  ALWAYS_TRUE,
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
        if (childValue === null || childValue === undefined) {
          parts.push(compiledClause(`${qualifiedChildCol} IS NULL`));
        } else if (isObject(childValue) && !(childValue instanceof RegExp)) {
          parts.push(
            ...compileOperator(
              qualifiedChildCol,
              childValue as ConditionOperator<unknown>,
              params,
              childField,
              childField.key,
              dialect,
            ),
          );
        } else {
          params.push(childValue);
          parts.push(
            compiledClause(`${qualifiedChildCol} = ${dialect.placeholder(params)}`),
          );
        }
      }
      continue;
    }

    const colName = resolveColumnName(metadata.fields, key, metadata.relations);
    // For joined inheritance, child-only fields may live on a different table alias
    const effectiveAlias = fieldAliasOverrides?.get(key) ?? tableAlias;
    const qualifiedCol = effectiveAlias
      ? `${dialect.quoteIdentifier(effectiveAlias)}.${dialect.quoteIdentifier(colName)}`
      : dialect.quoteIdentifier(colName);

    if (value === null || value === undefined) {
      parts.push(compiledClause(`${qualifiedCol} IS NULL`));
      continue;
    }

    if (isObject(value) && !(value instanceof RegExp)) {
      const ops = value as ConditionOperator<unknown>;
      const field = metadata.fields.find((f) => f.key === key) ?? null;
      parts.push(...compileOperator(qualifiedCol, ops, params, field, key, dialect));
    } else {
      params.push(value);
      parts.push(compiledClause(`${qualifiedCol} = ${dialect.placeholder(params)}`));
    }
  }

  return conjoin(parts);
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

    // A bare nested object on a NON-embedded column (`{ payload: { city: "x" } }`).
    // It compiles to no clause and therefore matches every row — a real gap, and
    // one that belongs with the containment work rather than here, because
    // closing it means emitting JSON containment rather than choosing a
    // representation.
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
      params.push(operand);
      return compiledClause(`${qualifiedCol} <> ${dialect.placeholder(params)}`);
    }

    case ConditionOperatorKey.Gt:
      params.push(operand);
      return compiledClause(`${qualifiedCol} > ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Gte:
      params.push(operand);
      return compiledClause(`${qualifiedCol} >= ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Lt:
      params.push(operand);
      return compiledClause(`${qualifiedCol} < ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Lte:
      params.push(operand);
      return compiledClause(`${qualifiedCol} <= ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Between: {
      const [low, high] = operand as [unknown, unknown];
      params.push(low);
      const lowPlaceholder = dialect.placeholder(params);
      params.push(high);
      const highPlaceholder = dialect.placeholder(params);
      return compiledClause(
        `${qualifiedCol} BETWEEN ${lowPlaceholder} AND ${highPlaceholder}`,
      );
    }

    case ConditionOperatorKey.In: {
      const array = operand as Array<unknown>;
      // `$in: []` can never hold. It is well-formed and useful — "match nothing"
      // — so it is a state of its own rather than a clause that happens to say
      // FALSE.
      if (array.length === 0) return ALWAYS_FALSE;

      const placeholders = array.map((value) => {
        params.push(value);
        return dialect.placeholder(params);
      });
      return compiledClause(`${qualifiedCol} IN (${placeholders.join(", ")})`);
    }

    case ConditionOperatorKey.Nin: {
      const array = operand as Array<unknown>;
      // `$nin: []` excludes nothing, so EVERY row satisfies it. That is not the
      // same as "nothing to emit", and conflating the two turned
      // `deleteMany({ tag: { $nin: [] } })` into `DELETE FROM t`.
      if (array.length === 0) return ALWAYS_TRUE;

      const placeholders = array.map((value) => {
        params.push(value);
        return dialect.placeholder(params);
      });
      return compiledClause(`${qualifiedCol} NOT IN (${placeholders.join(", ")})`);
    }

    case ConditionOperatorKey.Like:
      params.push(operand);
      return compiledClause(`${qualifiedCol} LIKE ${dialect.placeholder(params)}`);

    case ConditionOperatorKey.Ilike:
      return compiledClause(dialect.compileIlike(qualifiedCol, params, operand));

    case ConditionOperatorKey.Similar:
      return compiledClause(dialect.compileSimilar(qualifiedCol, params, operand));

    case ConditionOperatorKey.Regex: {
      const regex = operand instanceof RegExp ? operand : new RegExp(String(operand));
      const result = dialect.compileRegex(qualifiedCol, params, regex);
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
      const [divisor, remainder] = operand as [number, number];
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
      // The falsy short-circuit and the non-object coercion are BOTH kept as
      // they were. The language now says a non-object `$not` is malformed and
      // must throw; that is an operator change and lands with the other operator
      // changes, not with the representation.
      if (!operand) return ALWAYS_TRUE;

      const inner = isObject(operand)
        ? (operand as ConditionOperator<unknown>)
        : ({ $eq: operand } as ConditionOperator<unknown>);

      return negate(
        conjoin(compileOperator(qualifiedCol, inner, params, field, fieldKey, dialect)),
      );
    }

    case LogicalOperatorKey.And:
    case LogicalOperatorKey.Or:
      // Declared by the language, never implemented here. The if-chain this
      // switch replaced had no branch for either, so they compiled to NOTHING
      // and matched every row. Throwing is strictly better than that, and the
      // branches land with the other operator work.
      throw new NotSupportedError(
        `Field-level operator "${key}" is not supported by the SQL compiler`,
        {
          code: "unsupported_operator",
          title: "Unsupported Operator",
          details:
            "Field-level logical operators are not compiled to SQL. Use a criteria-level $and / $or instead.",
          data: { operator: key, field: fieldKey },
        },
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
