import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { PredicateEntry, RawWhereEntry } from "../../../../types/query";
import { compileHaving as shared } from "../../../../utils/sql/compile-having";
import { mysqlDialect } from "../mysql-dialect";
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
    mysqlDialect,
    compilePredicate,
  );
