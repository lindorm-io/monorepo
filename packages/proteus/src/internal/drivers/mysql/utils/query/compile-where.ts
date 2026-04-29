import type { Dict, Predicate } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { PredicateEntry } from "../../../../types/query.js";
import {
  compileWhere as sharedCompileWhere,
  compilePredicate as sharedCompilePredicate,
  type FieldAliasOverrides,
} from "../../../../utils/sql/compile-where.js";
import { mysqlDialect } from "../mysql-dialect.js";

export type { FieldAliasOverrides };

export const compileWhere = <E extends IEntity>(
  entries: Array<PredicateEntry<E>>,
  metadata: EntityMetadata,
  tableAlias: string | null,
  params: Array<unknown>,
  fieldAliasOverrides?: FieldAliasOverrides,
): string =>
  sharedCompileWhere(
    entries,
    metadata,
    tableAlias,
    params,
    mysqlDialect,
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
    mysqlDialect,
    fieldAliasOverrides,
  );
