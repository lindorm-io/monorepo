import { isObject } from "@lindorm/is";
import type { Dict, Predicate, PredicateOperator } from "@lindorm/types";
import type { IEntity } from "../../../interfaces/index.js";
import type { EntityMetadata, MetaField } from "../../entity/types/metadata.js";
import type { PredicateEntry } from "../../types/query.js";
import { NotSupportedError, ProteusError } from "../../../errors/index.js";
import { resolveColumnName } from "./resolve-column-name.js";
import type { SqlDialect } from "./sql-dialect.js";

const ARRAY_OPERATORS = ["$all", "$overlap", "$contained"] as const;

const PREDICATE_OP_PREFIXES = [
  "$eq",
  "$neq",
  "$gt",
  "$gte",
  "$lt",
  "$lte",
  "$in",
  "$nin",
  "$like",
  "$ilike",
  "$between",
  "$all",
  "$overlap",
  "$contained",
  "$length",
  "$mod",
  "$exists",
  "$regex",
  "$has",
  "$and",
  "$or",
  "$not",
] as const;

const hasPredicateOperator = (obj: Record<string, unknown>): boolean =>
  Object.keys(obj).some((k) => (PREDICATE_OP_PREFIXES as readonly string[]).includes(k));

const guardArrayField = (
  operator: string,
  field: MetaField | null,
  fieldKey: string,
): void => {
  if (!field) return; // join key columns — skip guard (no field metadata available)
  if (field.type === "array") return;
  throw new ProteusError(
    `Operator "${operator}" requires an array-typed column, but field "${fieldKey}" has type "${field.type}"`,
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
    const compiled = compilePredicate(
      entry.predicate as Predicate<Dict>,
      metadata,
      tableAlias,
      params,
      dialect,
      fieldAliasOverrides,
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
  predicate: Predicate<Dict>,
  metadata: EntityMetadata,
  tableAlias: string | null,
  params: Array<unknown>,
  dialect: SqlDialect,
  fieldAliasOverrides?: FieldAliasOverrides,
): string => {
  const parts: Array<string> = [];

  if (predicate.$and) {
    const subClauses = predicate.$and
      .map((sub) =>
        compilePredicate(
          sub as Predicate<Dict>,
          metadata,
          tableAlias,
          params,
          dialect,
          fieldAliasOverrides,
        ),
      )
      .filter(Boolean);
    if (subClauses.length > 0) {
      parts.push(`(${subClauses.join(" AND ")})`);
    }
  }

  if (predicate.$or) {
    const subClauses = predicate.$or
      .map((sub) =>
        compilePredicate(
          sub as Predicate<Dict>,
          metadata,
          tableAlias,
          params,
          dialect,
          fieldAliasOverrides,
        ),
      )
      .filter(Boolean);
    if (subClauses.length > 0) {
      parts.push(`(${subClauses.join(" OR ")})`);
    }
  }

  if (predicate.$not) {
    const sub = compilePredicate(
      predicate.$not as Predicate<Dict>,
      metadata,
      tableAlias,
      params,
      dialect,
      fieldAliasOverrides,
    );
    if (sub) {
      parts.push(`NOT (${sub})`);
    }
  }

  for (const [key, value] of Object.entries(predicate)) {
    if (key === "$and" || key === "$or" || key === "$not") continue;

    // Embedded parent key expansion — must run BEFORE resolveColumnName
    // which would throw for parent keys like "address" that have no direct column.
    const embeddedChildren = metadata.fields.filter((f) => f.embedded?.parentKey === key);
    if (
      embeddedChildren.length > 0 &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
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
          parts.push(`${qualifiedChildCol} IS NULL`);
        } else if (isObject(childValue) && !(childValue instanceof RegExp)) {
          parts.push(
            ...compileOperator(
              qualifiedChildCol,
              childValue as PredicateOperator<unknown>,
              params,
              childField,
              childField.key,
              dialect,
            ),
          );
        } else {
          params.push(childValue);
          parts.push(`${qualifiedChildCol} = ${dialect.placeholder(params)}`);
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
      parts.push(`${qualifiedCol} IS NULL`);
      continue;
    }

    if (isObject(value) && !(value instanceof RegExp)) {
      const ops = value as PredicateOperator<unknown>;
      const field = metadata.fields.find((f) => f.key === key) ?? null;
      const operatorClauses = compileOperator(
        qualifiedCol,
        ops,
        params,
        field,
        key,
        dialect,
      );
      parts.push(...operatorClauses);
    } else {
      params.push(value);
      parts.push(`${qualifiedCol} = ${dialect.placeholder(params)}`);
    }
  }

  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  return `(${parts.join(" AND ")})`;
};

const compileOperator = (
  qualifiedCol: string,
  ops: PredicateOperator<unknown>,
  params: Array<unknown>,
  field: MetaField | null,
  fieldKey: string,
  dialect: SqlDialect,
): Array<string> => {
  const clauses: Array<string> = [];

  // Validate array operators are only used on array-typed columns
  for (const op of ARRAY_OPERATORS) {
    if (op in ops) {
      guardArrayField(op, field, fieldKey);
    }
  }

  if ("$eq" in ops) {
    if (ops.$eq === null || ops.$eq === undefined) {
      clauses.push(`${qualifiedCol} IS NULL`);
    } else {
      params.push(ops.$eq);
      clauses.push(`${qualifiedCol} = ${dialect.placeholder(params)}`);
    }
  }

  if ("$neq" in ops) {
    if (ops.$neq === null || ops.$neq === undefined) {
      clauses.push(`${qualifiedCol} IS NOT NULL`);
    } else {
      params.push(ops.$neq);
      clauses.push(`${qualifiedCol} <> ${dialect.placeholder(params)}`);
    }
  }

  if ("$gt" in ops) {
    params.push(ops.$gt);
    clauses.push(`${qualifiedCol} > ${dialect.placeholder(params)}`);
  }

  if ("$gte" in ops) {
    params.push(ops.$gte);
    clauses.push(`${qualifiedCol} >= ${dialect.placeholder(params)}`);
  }

  if ("$lt" in ops) {
    params.push(ops.$lt);
    clauses.push(`${qualifiedCol} < ${dialect.placeholder(params)}`);
  }

  if ("$lte" in ops) {
    params.push(ops.$lte);
    clauses.push(`${qualifiedCol} <= ${dialect.placeholder(params)}`);
  }

  if ("$between" in ops) {
    const [low, high] = ops.$between as [unknown, unknown];
    params.push(low);
    const lowPlaceholder = dialect.placeholder(params);
    params.push(high);
    const highPlaceholder = dialect.placeholder(params);
    clauses.push(`${qualifiedCol} BETWEEN ${lowPlaceholder} AND ${highPlaceholder}`);
  }

  if ("$in" in ops) {
    const array = ops.$in as Array<unknown>;
    if (array.length === 0) {
      clauses.push("FALSE");
    } else {
      const placeholders = array.map((value) => {
        params.push(value);
        return dialect.placeholder(params);
      });
      clauses.push(`${qualifiedCol} IN (${placeholders.join(", ")})`);
    }
  }

  if ("$nin" in ops) {
    const array = ops.$nin as Array<unknown>;
    if (array.length === 0) {
      // NOT IN (empty) is always true — no-op
    } else {
      const placeholders = array.map((value) => {
        params.push(value);
        return dialect.placeholder(params);
      });
      clauses.push(`${qualifiedCol} NOT IN (${placeholders.join(", ")})`);
    }
  }

  if ("$like" in ops) {
    params.push(ops.$like);
    clauses.push(`${qualifiedCol} LIKE ${dialect.placeholder(params)}`);
  }

  if ("$ilike" in ops) {
    clauses.push(dialect.compileIlike(qualifiedCol, params, ops.$ilike));
  }

  if ("$regex" in ops) {
    const raw = ops.$regex;
    const regex = raw instanceof RegExp ? raw : new RegExp(String(raw));
    const result = dialect.compileRegex(qualifiedCol, params, regex);
    if (result === null) {
      throw new NotSupportedError("The $regex operator is not supported by this driver");
    }
    clauses.push(result);
  }

  if ("$exists" in ops) {
    if (ops.$exists) {
      clauses.push(`${qualifiedCol} IS NOT NULL`);
    } else {
      clauses.push(`${qualifiedCol} IS NULL`);
    }
  }

  if ("$all" in ops) {
    const arr = ops.$all as Array<unknown>;
    clauses.push(dialect.compileAll(qualifiedCol, params, arr, field));
  }

  if ("$overlap" in ops) {
    const arr = ops.$overlap as Array<unknown>;
    clauses.push(dialect.compileOverlap(qualifiedCol, params, arr, field));
  }

  if ("$contained" in ops) {
    const arr = ops.$contained as Array<unknown>;
    clauses.push(dialect.compileContained(qualifiedCol, params, arr, field));
  }

  if ("$length" in ops) {
    clauses.push(dialect.compileLength(qualifiedCol, params, ops.$length));
  }

  if ("$has" in ops) {
    clauses.push(dialect.compileHas(qualifiedCol, params, ops.$has));
  }

  if ("$mod" in ops) {
    const [divisor, remainder] = ops.$mod as [number, number];
    params.push(divisor);
    const divisorPlaceholder = dialect.placeholder(params);
    params.push(remainder);
    const remainderPlaceholder = dialect.placeholder(params);
    clauses.push(`(${qualifiedCol} % ${divisorPlaceholder}) = ${remainderPlaceholder}`);
  }

  return clauses;
};
