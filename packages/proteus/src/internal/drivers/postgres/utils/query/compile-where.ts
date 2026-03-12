import type { Dict, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { PredicateEntry } from "#internal/types/query";
import {
  compileWhere as sharedCompileWhere,
  compilePredicate as sharedCompilePredicate,
  type FieldAliasOverrides,
} from "#internal/utils/sql/compile-where";
import { postgresDialect } from "../postgres-dialect";

export type { FieldAliasOverrides };

export const compileWhere = <E extends IEntity>(
  entries: Array<PredicateEntry<E>>,
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
  fieldAliasOverrides?: FieldAliasOverrides,
): string =>
  sharedCompileWhere(
    entries,
    metadata,
    tableAlias,
    params,
    postgresDialect,
    fieldAliasOverrides,
  );

export const compilePredicate = (
  predicate: Predicate<Dict>,
  metadata: EntityMetadata,
  tableAlias: string | null,
  params: Array<unknown>,
  fieldAliasOverrides?: FieldAliasOverrides,
): string =>
  sharedCompilePredicate(
    predicate,
    metadata,
    tableAlias,
    params,
    postgresDialect,
    fieldAliasOverrides,
  );
