import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { PredicateEntry, RawWhereEntry } from "../../../../types/query.js";
import { compileHaving as shared } from "../../../../utils/sql/compile-having.js";
import { sqliteDialect } from "../sqlite-dialect.js";
import { compilePredicate } from "./compile-where.js";

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
    sqliteDialect,
    compilePredicate,
  );
