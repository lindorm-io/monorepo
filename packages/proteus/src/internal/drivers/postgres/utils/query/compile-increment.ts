import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import { createEmptyState } from "../../../../../classes/QueryBuilder";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";
import { resolveColumnName } from "../resolve-column-name";
import type { CompiledSql } from "./compiled-sql";
import {
  buildInheritanceAliases,
  compileInheritanceFrom,
} from "./compile-inheritance-join";
import { compileWhereWithFilters } from "./compile-system-filters";
import { resolveTableName } from "./resolve-table-name";

export const compileIncrement = <E extends IEntity>(
  criteria: Predicate<E>,
  property: keyof E,
  value: number,
  metadata: EntityMetadata,
  namespace?: string | null,
): CompiledSql => {
  const resolved = resolveTableName(metadata, namespace);
  const tableName = quoteQualifiedName(resolved.schema, resolved.name);
  const columnName = resolveColumnName(metadata.fields, property as string);

  const params: Array<unknown> = [];
  params.push(value);
  const valueIdx = params.length;

  const state = createEmptyState<E>();
  state.predicates = [{ predicate: criteria, conjunction: "and" }];
  const whereClause = compileWhereWithFilters(state, metadata, params);

  // Inheritance FROM for joined children (PG UPDATE uses FROM, not JOIN)
  const { aliases: inheritanceAliases } = buildInheritanceAliases(
    metadata,
    namespace ?? null,
    1,
  );
  const { fromClause, joinConditions } = compileInheritanceFrom(
    metadata,
    inheritanceAliases,
    "t0",
  );

  // Inject join conditions into WHERE clause
  let effectiveWhere = whereClause;
  if (joinConditions.length > 0) {
    const joinPredicate = joinConditions.join(" AND ");
    if (effectiveWhere) {
      // whereClause starts with "WHERE ..." — inject join conditions after WHERE keyword
      effectiveWhere = effectiveWhere.replace(/^WHERE /, `WHERE ${joinPredicate} AND `);
    } else {
      effectiveWhere = `WHERE ${joinPredicate}`;
    }
  }

  const text = [
    `UPDATE ${tableName} AS "t0" SET ${quoteIdentifier(columnName)} = "t0".${quoteIdentifier(columnName)} + $${valueIdx}`,
    fromClause,
    effectiveWhere,
  ]
    .filter(Boolean)
    .join(" ");

  return { text, params };
};
