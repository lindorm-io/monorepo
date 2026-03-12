import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { PredicateEntry, RawWhereEntry } from "#internal/types/query";
import { compileHaving as shared } from "#internal/utils/sql/compile-having";
import { postgresDialect } from "../postgres-dialect";
import { compilePredicate } from "./compile-where";

export const compileHaving = <E extends IEntity>(
  entries: Array<PredicateEntry<E>>,
  rawEntries: Array<RawWhereEntry>,
  metadata: EntityMetadata,
  tableAlias: string,
  params: Array<unknown>,
): string =>
  shared(
    entries,
    rawEntries,
    metadata,
    tableAlias,
    params,
    postgresDialect,
    compilePredicate,
  );
